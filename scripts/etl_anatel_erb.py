#!/usr/bin/env python3
"""
HYPR Cell Map — ETL: Anatel SMP → Supabase
Downloads the Anatel ERB CSV, deduplicates by station+operator,
derives technology from frequency, and inserts into Supabase.

Usage:
  python scripts/etl_anatel_erb.py [--sample N] [--skip-download]

Requires env vars:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import os
import sys
import csv
import json
import math
import argparse
import urllib.request
import urllib.error
from io import StringIO
from collections import defaultdict
from datetime import datetime

# ─── Config ───────────────────────────────────────────────

ANATEL_CSV_URL = "https://www.anatel.gov.br/dadosabertos/PDA/Estacoes_Licenciadas/Estacoes_Licenciadas_SMP.csv"
LOCAL_CSV = "scripts/anatel_smp_raw.csv"
IBGE_CENTROIDS_URL = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv"
LOCAL_IBGE = "scripts/ibge_municipios.csv"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

BATCH_SIZE = 500

# ─── Operator normalization ───────────────────────────────

OPERATOR_MAP = {
    "TELEFONICA BRASIL S.A.": "Vivo",
    "TELEFÔNICA BRASIL S.A.": "Vivo",
    "VIVO S.A.": "Vivo",
    "CLARO S.A.": "Claro",
    "CLARO S/A": "Claro",
    "CLARO NXT TELECOMUNICACOES LTDA": "Claro",
    "TIM S/A": "TIM",
    "TIM S A": "TIM",
    "TIM CELULAR S.A.": "TIM",
    "BRISANET SERVICOS DE TELECOMUNICACOES S.A.": "Brisanet",
    "BRISANET SERVICOS DE TELECOMUNICACOES S.A": "Brisanet",
    "ALGAR TELECOM S/A": "Algar",
    "ALGAR TELECOM S.A.": "Algar",
    "UNIFIQUE TELECOMUNICACOES S/A": "Unifique",
    "UNIFIQUE TELECOMUNICACOES S.A.": "Unifique",
    "SERCOMTEL S.A. TELECOMUNICAÇÕES": "Sercomtel",
    "SERCOMTEL CELULAR S.A.": "Sercomtel",
    "SERCOMTEL S.A. TELECOMUNICACOES": "Sercomtel",
    "AMAZONIA CELULAR S/A": "Vivo",  # Vivo subsidiary
    "AMAZÔNIA CELULAR S.A.": "Vivo",
}


def normalize_operator(raw: str) -> str:
    import unicodedata
    # Normalize unicode and strip accents for comparison
    raw_clean = raw.strip().upper()
    # Handle encoding artifacts: Ã\x94 = Ô, Ã\x87 = Ç, etc.
    raw_ascii = unicodedata.normalize("NFKD", raw_clean).encode("ascii", "ignore").decode("ascii")
    
    # Match on normalized ASCII version
    if "TELEFONICA" in raw_ascii or "TELEFNICA" in raw_ascii or "VIVO" in raw_ascii:
        return "Vivo"
    if "AMAZONIA" in raw_ascii or "AMAZNIA" in raw_ascii:
        return "Vivo"  # Vivo subsidiary
    if "CLARO" in raw_ascii or "NXT" in raw_ascii or "NEXTEL" in raw_ascii:
        return "Claro"
    if "TIM " in raw_ascii or raw_ascii.startswith("TIM") or "TIM S" in raw_ascii:
        return "TIM"
    if "BRISANET" in raw_ascii:
        return "Brisanet"
    if "ALGAR" in raw_ascii:
        return "Algar"
    if "UNIFIQUE" in raw_ascii:
        return "Unifique"
    if "SERCOMTEL" in raw_ascii:
        return "Sercomtel"
    if "OI " in raw_ascii or raw_ascii.startswith("OI") or "TELEMAR" in raw_ascii:
        return "Claro"  # Oi was acquired by Claro/Vivo/TIM consortium
    
    # Fallback: also check original with common encoding issues
    if "TELEF" in raw_clean:
        return "Vivo"
    if "AMAZ" in raw_clean:
        return "Vivo"
    
    return "Outras"


# ─── Technology derivation from frequency ─────────────────

# Brazilian SMP frequency allocation
# Source: Anatel frequency plan + public auction results
FREQ_TO_TECH = [
    # 5G bands
    (3300, 3800, "5G"),   # 3.5 GHz (leilão 5G standalone)
    (24250, 27500, "5G"), # mmWave 26 GHz
    
    # 4G bands (LTE)
    (690, 780, "4G"),     # 700 MHz (digital dividend)
    (1710, 1785, "4G"),   # 1800 MHz (refarmed)
    (1805, 1880, "4G"),   # 1800 MHz (paired)
    (2500, 2690, "4G"),   # 2600 MHz (leilão 4G)
    (2300, 2400, "4G"),   # 2300 MHz TDD
    
    # 3G bands (WCDMA/HSPA)
    (1900, 1980, "3G"),   # 1900/2100 MHz
    (2110, 2170, "3G"),   # 2100 MHz (IMT core)
    
    # 2G bands (GSM)
    (824, 849, "2G"),     # 850 MHz (Cellular A/B)
    (869, 894, "2G"),     # 850 MHz (paired)
    (880, 915, "2G"),     # 900 MHz
    (925, 960, "2G"),     # 900 MHz (paired)
    (935, 960, "2G"),     # 900 MHz extended
    
    # Mixed: these bands are used by multiple techs
    # 850 MHz can be 2G or 3G, 1800 can be 2G or 4G
    # We default to the newer tech since most operators have refarmed
]

# Some frequencies are shared between techs. Use emission designation to disambiguate
EMISSION_TECH = {
    "5M00G7W": "3G",   # WCDMA 5MHz
    "5M00G9W": "4G",   # LTE 5MHz
    "5M00D9W": "4G",   # LTE 5MHz OFDM
    "5M00D7W": "4G",   # LTE 5MHz
    "10M0G7W": "4G",   # LTE 10MHz
    "10M0G9W": "4G",   # LTE 10MHz
    "10M0D7W": "4G",   # LTE 10MHz
    "15M0G7W": "4G",   # LTE 15MHz
    "15M0G9W": "4G",   # LTE 15MHz
    "20M0G7W": "4G",   # LTE 20MHz
    "20M0G9W": "4G",   # LTE 20MHz
    "20M0D7W": "4G",   # LTE 20MHz
    "40M0G7W": "5G",   # NR 40MHz
    "50M0G7W": "5G",   # NR 50MHz
    "60M0G7W": "5G",   # NR 60MHz
    "80M0G7W": "5G",   # NR 80MHz
    "100MG7W": "5G",   # NR 100MHz
    "200KG7W": "2G",   # GSM 200kHz
    "200KG1D": "2G",   # GSM GMSK
    "200KM7W": "2G",   # GSM 200kHz
    "1M25F9W": "2G",   # GSM/EDGE
    "1M25G7W": "2G",   # GSM
    "30K0DXW": "2G",   # GSM signaling
    "40K0G1D": "2G",   # GSM control
    "40K0G3E": "2G",   # GSM
    "40K0F1D": "2G",   # GSM
    "40K0F3E": "2G",   # GSM
    "40K0F8W": "2G",   # GSM
    "2M50F9W": "3G",   # WCDMA
    "2M50G7W": "3G",   # WCDMA
    "3M73F9W": "3G",   # WCDMA
}


def derive_tech(freq_mhz: float, emission: str = "") -> str:
    """Derive technology from frequency and emission designation."""
    # First try emission-based detection (most accurate)
    em = emission.strip().upper().replace("\r", "").replace("\n", "")
    if em in EMISSION_TECH:
        return EMISSION_TECH[em]
    
    # Bandwidth from emission can indicate tech
    # Wide bandwidth (>= 5MHz) on certain bands = LTE/NR
    if em:
        try:
            bw_str = ""
            for c in em:
                if c.isdigit() or c == '.':
                    bw_str += c
                elif c in ('K', 'M', 'G'):
                    if c == 'K':
                        bw_val = float(bw_str) / 1000 if bw_str else 0
                    elif c == 'M':
                        bw_val = float(bw_str) if bw_str else 0
                    else:
                        bw_val = float(bw_str) * 1000 if bw_str else 0
                    
                    if bw_val >= 40:
                        return "5G"
                    elif bw_val >= 5:
                        return "4G"
                    break
        except (ValueError, IndexError):
            pass
    
    # Frequency-based fallback
    if freq_mhz <= 0:
        return "2G"  # default for unknown
    
    for low, high, tech in FREQ_TO_TECH:
        if low <= freq_mhz <= high:
            return tech
    
    # Heuristic for common Brazilian SMP frequencies
    if 830 <= freq_mhz <= 900:
        return "2G"
    if 940 <= freq_mhz <= 960:
        return "2G"
    if 1800 <= freq_mhz <= 1900:
        return "4G"  # Most 1800 has been refarmed to LTE
    if 2100 <= freq_mhz <= 2200:
        return "3G"
    if 2500 <= freq_mhz <= 2700:
        return "4G"
    if freq_mhz >= 3000:
        return "5G"
    
    return "2G"


def freq_to_band(freq_mhz: float) -> str:
    """Map frequency to band label."""
    if freq_mhz <= 0:
        return ""
    if 690 <= freq_mhz <= 780:
        return "700"
    if 824 <= freq_mhz <= 960:
        return "850"
    if 1710 <= freq_mhz <= 1880:
        return "1800"
    if 1900 <= freq_mhz <= 2200:
        return "2100"
    if 2300 <= freq_mhz <= 2400:
        return "2300"
    if 2500 <= freq_mhz <= 2700:
        return "2600"
    if 3300 <= freq_mhz <= 3800:
        return "3500"
    if freq_mhz >= 24000:
        return "26000"
    return str(int(freq_mhz))


TECH_RANK = {"5G": 4, "4G": 3, "3G": 2, "2G": 1}


def highest_tech(techs: list) -> str:
    if not techs:
        return "2G"
    return max(techs, key=lambda t: TECH_RANK.get(t, 0))


# ─── Download helpers ─────────────────────────────────────

def download_file(url: str, dest: str, encoding: str = None):
    """Download a file with progress."""
    print(f"  Downloading {url}")
    print(f"  → {dest}")
    
    req = urllib.request.Request(url, headers={"User-Agent": "HYPR-ETL/1.0"})
    response = urllib.request.urlopen(req)
    total = int(response.headers.get("Content-Length", 0))
    
    downloaded = 0
    with open(dest, "wb") as f:
        while True:
            chunk = response.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            if total > 0:
                pct = downloaded / total * 100
                print(f"\r  {downloaded / 1024 / 1024:.0f}MB / {total / 1024 / 1024:.0f}MB ({pct:.1f}%)", end="", flush=True)
    print()
    
    # Convert encoding if needed
    if encoding:
        print(f"  Converting from {encoding} to UTF-8...")
        with open(dest, "rb") as f:
            raw = f.read()
        with open(dest, "w", encoding="utf-8") as f:
            f.write(raw.decode(encoding, errors="replace"))


# ─── IBGE centroids ───────────────────────────────────────

def load_ibge_centroids(path: str) -> dict:
    """Load IBGE municipality centroids as {cod_municipio: (lat, lng, name, uf)}."""
    # Numeric IBGE UF code → 2-letter state code
    UF_CODE_MAP = {
        11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
        21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL",
        28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP",
        41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
    }
    
    centroids = {}
    if not os.path.exists(path):
        print("  Downloading IBGE municipality data...")
        download_file(IBGE_CENTROIDS_URL, path)
    
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                cod = int(row.get("codigo_ibge", 0))
                lat = float(row.get("latitude", 0))
                lng = float(row.get("longitude", 0))
                name = row.get("nome", "")
                uf_num = int(row.get("codigo_uf", 0))
                uf = UF_CODE_MAP.get(uf_num, "")
                if cod and lat and lng and uf:
                    centroids[cod] = (lat, lng, name, uf)
            except (ValueError, KeyError):
                continue
    
    print(f"  Loaded {len(centroids)} municipality centroids")
    return centroids


# ─── Main ETL ─────────────────────────────────────────────

def parse_float(s: str) -> float:
    """Parse float, returning 0 for invalid values."""
    s = s.strip().replace("\r", "").replace("\n", "")
    if not s or s == "*" or s == "NaN" or s == "nan":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_int(s: str) -> int:
    s = s.strip().replace("\r", "").replace("\n", "")
    if not s:
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def process_csv(csv_path: str, centroids: dict, sample_limit: int = 0) -> list:
    """
    Read Anatel CSV, deduplicate by (operator, station_number),
    aggregate frequencies/techs/azimutes per station.
    Returns list of station dicts ready for insert.
    """
    print(f"\n[2/4] Processing CSV: {csv_path}")
    
    # Group rows by (prestadora_norm, num_estacao)
    stations = defaultdict(lambda: {
        "prestadora": "",
        "prestadora_norm": "",
        "cnpj": "",
        "num_estacao": "",
        "uf": "",
        "cod_uf": 0,
        "municipio": "",
        "cod_municipio": 0,
        "logradouro": "",
        "lat": 0.0,
        "lng": 0.0,
        "coord_source": "anatel",
        "freqs": set(),
        "techs": set(),
        "faixas": set(),
        "azimutes": set(),
        "emissoes": set(),
        "data_lic": None,
    })
    
    row_count = 0
    skip_count = 0
    
    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        
        for row in reader:
            if len(row) < 15:
                skip_count += 1
                continue
            
            row_count += 1
            if row_count % 500000 == 0:
                print(f"  Processed {row_count:,} rows...")
            
            prestadora = row[0].strip()
            if not prestadora:
                skip_count += 1
                continue
            
            prestadora_norm = normalize_operator(prestadora)
            num_estacao = row[2].strip()
            key = (prestadora_norm, num_estacao)
            
            st = stations[key]
            
            # Keep first non-empty value for scalar fields
            if not st["prestadora"]:
                st["prestadora"] = prestadora
            st["prestadora_norm"] = prestadora_norm
            if not st["cnpj"]:
                st["cnpj"] = row[1].strip()
            st["num_estacao"] = num_estacao
            if not st["uf"]:
                st["uf"] = row[4].strip()
            if not st["cod_uf"]:
                st["cod_uf"] = parse_int(row[5])
            if not st["municipio"]:
                st["municipio"] = row[6].strip()
            if not st["cod_municipio"]:
                st["cod_municipio"] = parse_int(row[7])
            if not st["logradouro"]:
                st["logradouro"] = row[8].strip()
            
            # Coordinates: keep first valid pair
            if st["lat"] == 0.0:
                lat = parse_float(row[9])
                lng = parse_float(row[10])
                if lat != 0 and lng != 0 and -34 <= lat <= 6 and -74 <= lng <= -30:
                    st["lat"] = lat
                    st["lng"] = lng
            
            # Aggregate frequencies, techs, azimutes
            freq_ini = parse_float(row[11])
            emission = row[14].strip() if len(row) > 14 else ""
            
            if freq_ini > 0:
                st["freqs"].add(round(freq_ini, 1))
                tech = derive_tech(freq_ini, emission)
                st["techs"].add(tech)
                band = freq_to_band(freq_ini)
                if band:
                    st["faixas"].add(band)
            
            azimute = parse_float(row[13])
            if azimute > 0:
                st["azimutes"].add(int(azimute))
            
            if emission:
                st["emissoes"].add(emission.replace("\r", ""))
    
    print(f"  Total rows: {row_count:,} | Skipped: {skip_count:,}")
    print(f"  Unique stations (pre-filter): {len(stations):,}")
    
    # Apply IBGE centroid fallback for missing coords
    fallback_count = 0
    no_coord_count = 0
    
    results = []
    for key, st in stations.items():
        # Skip stations with no location info at all
        if not st["uf"]:
            continue
        
        # Fallback to IBGE centroid if no Anatel coords
        if st["lat"] == 0.0 or st["lng"] == 0.0:
            cod = st["cod_municipio"]
            if cod and cod in centroids:
                clat, clng, _, _ = centroids[cod]
                # Add small random offset to avoid stacking (±0.005°, ~500m)
                import hashlib
                h = hashlib.md5(f"{key[0]}{key[1]}".encode()).hexdigest()
                offset_lat = (int(h[:4], 16) / 65535 - 0.5) * 0.01
                offset_lng = (int(h[4:8], 16) / 65535 - 0.5) * 0.01
                st["lat"] = clat + offset_lat
                st["lng"] = clng + offset_lng
                st["coord_source"] = "ibge_centroid"
                fallback_count += 1
            else:
                no_coord_count += 1
                continue  # Skip stations we can't locate at all
        
        # Build final record
        techs = sorted(st["techs"], key=lambda t: TECH_RANK.get(t, 0), reverse=True)
        
        record = {
            "prestadora": st["prestadora"][:200],
            "prestadora_norm": st["prestadora_norm"],
            "cnpj": st["cnpj"][:20] if st["cnpj"] else None,
            "num_estacao": st["num_estacao"][:20],
            "uf": st["uf"][:2],
            "cod_uf": st["cod_uf"] or None,
            "municipio": st["municipio"][:200],
            "cod_municipio": st["cod_municipio"] or None,
            "logradouro": st["logradouro"][:500] if st["logradouro"] else None,
            "lat": round(st["lat"], 10),
            "lng": round(st["lng"], 10),
            "coord_source": st["coord_source"],
            "tecnologias": techs if techs else ["2G"],
            "tech_principal": highest_tech(techs) if techs else "2G",
            "freq_mhz": sorted(st["freqs"]) if st["freqs"] else [],
            "faixas": sorted(st["faixas"]) if st["faixas"] else [],
            "azimutes": sorted(st["azimutes"]) if st["azimutes"] else [],
            "emissoes": sorted(st["emissoes"])[:10] if st["emissoes"] else [],
        }
        
        results.append(record)
        
        if sample_limit and len(results) >= sample_limit:
            break
    
    print(f"  Anatel coords: {len(results) - fallback_count:,}")
    print(f"  IBGE centroid fallback: {fallback_count:,}")
    print(f"  Dropped (no coords): {no_coord_count:,}")
    print(f"  Final station count: {len(results):,}")
    
    return results


# ─── Supabase insert ──────────────────────────────────────

def supabase_request(method: str, path: str, data=None) -> dict:
    """Make a request to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",  # upsert
    }
    
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        resp = urllib.request.urlopen(req)
        return {"status": resp.status, "data": resp.read().decode("utf-8")}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "error": e.read().decode("utf-8")}


def upload_to_supabase(records: list):
    """Upload records to Supabase in batches."""
    print(f"\n[3/4] Uploading {len(records):,} records to Supabase...")
    
    # Clear existing data
    print("  Truncating existing erb data...")
    resp = supabase_request("DELETE", "/erb?id=gt.0")
    print(f"  Truncate response: {resp.get('status', 'N/A')}")
    
    # Insert in batches
    total = len(records)
    success = 0
    errors = 0
    
    for i in range(0, total, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        
        # Convert arrays to Postgres format for REST API
        for rec in batch:
            rec["tecnologias"] = "{" + ",".join(f'"{t}"' for t in rec["tecnologias"]) + "}"
            rec["freq_mhz"] = "{" + ",".join(str(f) for f in rec["freq_mhz"]) + "}"
            rec["faixas"] = "{" + ",".join(f'"{f}"' for f in rec["faixas"]) + "}"
            rec["azimutes"] = "{" + ",".join(str(a) for a in rec["azimutes"]) + "}"
            rec["emissoes"] = "{" + ",".join(f'"{e}"' for e in rec["emissoes"]) + "}"
        
        resp = supabase_request("POST", "/erb", batch)
        
        if resp.get("status") in (200, 201):
            success += len(batch)
        else:
            errors += len(batch)
            if errors <= 5:
                print(f"  ERROR batch {i}: {resp.get('error', resp)[:200]}")
        
        if (i + BATCH_SIZE) % 5000 == 0 or i + BATCH_SIZE >= total:
            print(f"  {min(i + BATCH_SIZE, total):,} / {total:,} ({success:,} ok, {errors:,} err)")
    
    print(f"  Done: {success:,} inserted, {errors:,} errors")


def upload_centroids(centroids: dict):
    """Upload IBGE centroids to Supabase."""
    print(f"\n  Uploading {len(centroids):,} município centroids...")
    
    records = []
    for cod, (lat, lng, name, uf_code) in centroids.items():
        records.append({
            "cod_municipio": cod,
            "municipio": name,
            "uf": uf_code[:2] if len(uf_code) >= 2 else "",
            "lat": lat,
            "lng": lng,
        })
    
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        supabase_request("POST", "/municipio_centroid", batch)
    
    print(f"  Done uploading centroids")


# ─── Stats ────────────────────────────────────────────────

def print_stats(records: list):
    """Print summary statistics."""
    print("\n[4/4] Summary Statistics")
    print("=" * 50)
    
    by_op = defaultdict(int)
    by_tech = defaultdict(int)
    by_uf = defaultdict(int)
    by_band = defaultdict(int)
    by_source = defaultdict(int)
    
    for r in records:
        by_op[r["prestadora_norm"]] += 1
        by_source[r["coord_source"]] += 1
        for t in (r["tecnologias"] if isinstance(r["tecnologias"], list) else []):
            by_tech[t] += 1
        by_uf[r["uf"]] += 1
        for b in (r["faixas"] if isinstance(r["faixas"], list) else []):
            by_band[b] += 1
    
    print(f"\nTotal ERBs: {len(records):,}")
    
    print(f"\nBy Operator:")
    for op, count in sorted(by_op.items(), key=lambda x: -x[1]):
        print(f"  {op:15s} {count:>8,} ({count/len(records)*100:.1f}%)")
    
    print(f"\nBy Technology:")
    for tech, count in sorted(by_tech.items(), key=lambda x: -TECH_RANK.get(x[0], 0)):
        print(f"  {tech:5s} {count:>8,}")
    
    print(f"\nBy Band (MHz):")
    for band, count in sorted(by_band.items(), key=lambda x: -x[1])[:10]:
        print(f"  {band:>6s} {count:>8,}")
    
    print(f"\nCoord Source:")
    for src, count in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  {src:20s} {count:>8,}")
    
    print(f"\nTop 5 UFs:")
    for uf, count in sorted(by_uf.items(), key=lambda x: -x[1])[:5]:
        print(f"  {uf} {count:>8,}")


# ─── Main ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="HYPR Cell Map ETL: Anatel SMP → Supabase")
    parser.add_argument("--sample", type=int, default=0, help="Limit to N stations (0 = all)")
    parser.add_argument("--skip-download", action="store_true", help="Skip CSV download")
    parser.add_argument("--dry-run", action="store_true", help="Process but don't upload")
    parser.add_argument("--stats-only", action="store_true", help="Just print stats from existing CSV")
    args = parser.parse_args()
    
    os.makedirs("scripts", exist_ok=True)
    
    print("=" * 50)
    print("HYPR Cell Map — ETL Pipeline")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 50)
    
    # Step 1: Download
    if not args.skip_download and not os.path.exists(LOCAL_CSV):
        print("\n[1/4] Downloading Anatel SMP CSV...")
        download_file(ANATEL_CSV_URL, LOCAL_CSV + ".raw")
        
        # Convert encoding
        print("  Converting ISO-8859-1 → UTF-8...")
        with open(LOCAL_CSV + ".raw", "rb") as f:
            raw = f.read()
        with open(LOCAL_CSV, "w", encoding="utf-8") as f:
            f.write(raw.decode("iso-8859-1", errors="replace"))
        os.remove(LOCAL_CSV + ".raw")
        print(f"  Saved: {LOCAL_CSV}")
    else:
        print("\n[1/4] Using existing CSV")
    
    # Load IBGE centroids
    centroids = load_ibge_centroids(LOCAL_IBGE)
    
    # Step 2: Process
    records = process_csv(LOCAL_CSV, centroids, sample_limit=args.sample)
    
    # Step 3: Stats
    print_stats(records)
    
    # Step 4: Upload
    if not args.dry_run and SUPABASE_URL and SUPABASE_KEY:
        upload_centroids(centroids)
        upload_to_supabase(records)
    elif args.dry_run:
        print("\n[3/4] DRY RUN — skipping upload")
    else:
        print("\n[3/4] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — skipping upload")
        print("  Set these env vars to enable upload")
    
    # Save as JSON for local dev
    output_json = "scripts/erb_processed.json"
    print(f"\n  Saving JSON snapshot: {output_json}")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(records[:1000], f, ensure_ascii=False, indent=None)
    print(f"  Saved first 1000 records for dev preview")
    
    print(f"\nDone: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
