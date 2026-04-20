#!/usr/bin/env python3
"""
HYPR Station — ETL: IBGE Municipal Density → mun-density.json

Cruza dois datasets oficiais IBGE para produzir densidade demográfica
(habitantes/km²) de cada município brasileiro:

  1. Estimativa da População 2024 (DOU/TCU)
     https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2024/
            estimativa_dou_2024.xls

  2. Malha Municipal Digital 2022 (atributos .dbf com AREA_KM2)
     https://geoftp.ibge.gov.br/organizacao_do_territorio/
            malhas_territoriais/malhas_municipais/municipio_2022/
            Brasil/BR/BR_Municipios_2022.zip

Output: public/assets/mun-density.json
Formato compacto indexado por chave normalizada "nome_uf":
{
  "version": 1,
  "source": "IBGE Estimativa Populacional 2024 + Malha Municipal 2022",
  "generated": "2026-04-20T00:00:00Z",
  "data": {
    "sao_paulo_SP": { "p": 11895578, "a": 1521.11, "d": 7820.4 },
    "rio_de_janeiro_RJ": { "p": 6729894, "a": 1200.18, "d": 5607.5 },
    ...
  }
}

Uso:
  python3 scripts/generate-mun-density.py

Os arquivos de entrada são baixados automaticamente se não existirem
em /tmp. Script idempotente — rode quantas vezes quiser.
"""

import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone
from io import BytesIO
from zipfile import ZipFile

POP_URL = "https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2024/estimativa_dou_2024.xls"
MESH_URL = "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2022/Brasil/BR/BR_Municipios_2022.zip"

POP_FILE = "/tmp/ibge_pop_2024.xls"
MESH_ZIP = "/tmp/ibge_mun2022.zip"
MESH_DBF = "/tmp/BR_Municipios_2022.dbf"

OUT_FILE = "public/assets/mun-density.json"


def normalize_key(name: str, uf: str) -> str:
    """Chave de lookup estável: remove acentos, lowercase, underscores.
    'São Paulo', 'SP' -> 'sao_paulo_SP'. A UF fica em uppercase pra evitar
    colisões entre municípios homônimos em UFs diferentes (ex: 'Santana' em
    PI, AP, BA)."""
    decomposed = unicodedata.normalize("NFD", name)
    ascii_name = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    ascii_name = ascii_name.lower()
    # substitui qualquer coisa que não seja a-z/0-9 por _
    ascii_name = re.sub(r"[^a-z0-9]+", "_", ascii_name).strip("_")
    return f"{ascii_name}_{uf.upper()}"


def download_if_missing(url: str, path: str, min_bytes: int = 10000) -> None:
    if os.path.exists(path) and os.path.getsize(path) > min_bytes:
        print(f"  [cache] {path} ({os.path.getsize(path):,} bytes)")
        return
    print(f"  [fetch] {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    print(f"  [saved] {path} ({os.path.getsize(path):,} bytes)")


def read_population() -> dict:
    """Retorna dict {cod_ibge_7_digit: populacao} a partir do XLS oficial.
    O XLS tem colunas: UF, COD. UF, COD. MUNIC, NOME DO MUNICÍPIO,
    POPULAÇÃO ESTIMADA. Código IBGE completo = COD.UF * 100000 + COD.MUNIC."""
    import xlrd
    wb = xlrd.open_workbook(POP_FILE)
    sheet = wb.sheet_by_name("MUNICÍPIOS")
    out: dict[int, int] = {}
    # Primeira linha útil é row=2 (row 0 é título, row 1 é header)
    for r in range(2, sheet.nrows):
        row = [sheet.cell_value(r, c) for c in range(5)]
        uf_sigla, cod_uf, cod_munic, nome, pop = row
        if not cod_uf or not cod_munic:
            continue
        try:
            uf_int = int(cod_uf)
            # COD. MUNIC vem com zeros à esquerda como string ("00015")
            # mas às vezes como float — normalizar
            if isinstance(cod_munic, float):
                mun_int = int(cod_munic)
                cod_ibge = uf_int * 100000 + mun_int
            else:
                # string "00015" — concatena com UF
                cod_ibge = int(f"{uf_int}{str(cod_munic).zfill(5)}")
            # População pode vir como "11.895.578" (string com pontos) ou float
            if isinstance(pop, (int, float)):
                pop_int = int(pop)
            else:
                pop_int = int(str(pop).replace(".", "").replace(",", "").strip())
            if pop_int > 0:
                out[cod_ibge] = pop_int
        except (ValueError, TypeError):
            continue
    return out


def read_areas() -> dict:
    """Retorna dict {cod_ibge_7_digit: (area_km2, nome, uf)} do DBF oficial.
    Campos da DBF IBGE 2022: CD_MUN, NM_MUN, SIGLA_UF, AREA_KM2."""
    from dbfread import DBF
    dbf = DBF(MESH_DBF, encoding="utf-8")
    out: dict[int, tuple[float, str, str]] = {}
    for rec in dbf:
        try:
            cod = int(rec["CD_MUN"])
            area = float(rec["AREA_KM2"])
            nome = str(rec["NM_MUN"]).strip()
            uf = str(rec["SIGLA_UF"]).strip()
            if area > 0 and nome and uf:
                out[cod] = (area, nome, uf)
        except (ValueError, KeyError, TypeError):
            continue
    return out


def main() -> int:
    print("=== HYPR ETL: IBGE Municipal Density ===")
    print("[1/4] Downloading IBGE sources...")
    download_if_missing(POP_URL, POP_FILE, min_bytes=100_000)

    if not os.path.exists(MESH_DBF) or os.path.getsize(MESH_DBF) < 10_000:
        download_if_missing(MESH_URL, MESH_ZIP, min_bytes=1_000_000)
        with ZipFile(MESH_ZIP) as z:
            z.extract("BR_Municipios_2022.dbf", "/tmp/")

    print("[2/4] Parsing population estimates (2024)...")
    pops = read_population()
    print(f"  Municipios with population: {len(pops):,}")

    print("[3/4] Parsing territorial areas (2022 mesh)...")
    areas = read_areas()
    print(f"  Municipios with area: {len(areas):,}")

    print("[4/4] Joining datasets and computing density...")
    data: dict[str, dict] = {}
    matched = 0
    pop_only = 0
    area_only = 0

    all_codes = set(pops.keys()) | set(areas.keys())
    for cod in all_codes:
        pop = pops.get(cod)
        area_tuple = areas.get(cod)
        if pop and area_tuple:
            area, nome, uf = area_tuple
            key = normalize_key(nome, uf)
            density = round(pop / area, 1)
            data[key] = {
                "p": pop,
                "a": round(area, 2),
                "d": density,
            }
            matched += 1
        elif pop:
            pop_only += 1
        elif area_tuple:
            area_only += 1

    print(f"  Matched: {matched:,}")
    print(f"  Population-only (no area): {pop_only}")
    print(f"  Area-only (no population): {area_only}")

    out_dir = os.path.dirname(OUT_FILE)
    os.makedirs(out_dir, exist_ok=True)

    payload = {
        "version": 1,
        "source": "IBGE Estimativa Populacional 2024 (DOU) + Malha Municipal Digital 2022",
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": matched,
        "data": data,
    }

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        # separators compactos pra reduzir tamanho do payload
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(OUT_FILE)
    print(f"\n✓ Wrote {OUT_FILE} ({size:,} bytes)")

    # Sanity check amostral
    print("\n=== Sanity check ===")
    for sample in ["sao_paulo_SP", "rio_de_janeiro_RJ", "brasilia_DF",
                   "salvador_BA", "curitiba_PR", "fortaleza_CE",
                   "recife_PE", "manaus_AM", "porto_alegre_RS"]:
        d = data.get(sample)
        if d:
            print(f"  {sample:<28} pop={d['p']:>12,}  area={d['a']:>9,.1f} km²  density={d['d']:>8,.1f} hab/km²")
        else:
            print(f"  {sample:<28} NOT FOUND")

    return 0


if __name__ == "__main__":
    sys.exit(main())
