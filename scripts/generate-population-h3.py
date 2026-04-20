#!/usr/bin/env python3
"""
HYPR Station — ETL: IBGE Censo 2022 Setores Censitários → H3 res 7

Cruza a malha oficial de setores censitários preliminares 2022 (GeoPackage com
atributos populacionais) com H3 res 7 (~5 km² por hexágono) para produzir o
dataset de população usado no estimador de audiência da plataforma.

Fonte oficial:
  https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/
  malha_com_atributos/setores/gpkg/UF/{UF}/{UF}_setores_CD2022.gpkg

Variável usada:
  v0001 — moradores em domicílios particulares permanentes (população oficial 2022)

Output:
  public/assets/pop-ibge-2022.json (formato colunar, ~3-5 MB)

Estratégia:
  Processamento UF a UF para controlar memória. Para cada setor:
    1. calcula centróide do polígono (EPSG:4674, SIRGAS 2000)
    2. converte (lat, lng) → H3 res 7
    3. acumula v0001 no hexágono correspondente

Uso:
  python3 scripts/generate-population-h3.py
  python3 scripts/generate-population-h3.py --ufs SP,RJ  (para testar)

Script idempotente: arquivos GPKG são cacheados em /tmp.
"""

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import geopandas as gpd
    import h3
except ImportError as e:
    print(f"Dependência faltando: {e}", file=sys.stderr)
    print("Instale com: pip install geopandas h3", file=sys.stderr)
    sys.exit(1)

H3_RESOLUTION = 7  # ~5.16 km² por hexágono — adequado para escala urbana/regional

UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
    "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
    "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
]

BASE_URL = (
    "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/"
    "Agregados_por_Setores_Censitarios/malha_com_atributos/setores/gpkg/UF"
)

CACHE_DIR = Path("/tmp/hypr-ibge-setores")
OUT_FILE = Path("public/assets/pop-ibge-2022.json")


def download_uf(uf: str) -> Path:
    """Baixa o GPKG de uma UF, com cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / f"{uf}_setores_CD2022.gpkg"
    if target.exists() and target.stat().st_size > 100_000:
        return target

    url = f"{BASE_URL}/{uf}/{uf}_setores_CD2022.gpkg"
    print(f"  [fetch] {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=600) as r, open(target, "wb") as f:
        # streaming pra não carregar 180 MB de SP em RAM
        while chunk := r.read(1 << 20):
            f.write(chunk)
    print(f"  [saved] {target.name} ({target.stat().st_size / 1e6:.1f} MB)")
    return target


def process_uf(
    uf: str,
    gpkg_path: Path,
    hex_pop_by_uf: dict[str, dict[str, int]],
) -> dict:
    """Lê o GPKG da UF e acumula população por hexágono H3 no dict compartilhado.

    O dict externo mapeia h3 → {uf → pop} para permitir definir a UF dominante
    de cada hex posteriormente (alguns hexes na fronteira contêm setores de
    múltiplas UFs).
    """
    gdf = gpd.read_file(gpkg_path, columns=["CD_SETOR", "v0001", "geometry"])
    gdf["v0001"] = gdf["v0001"].fillna(0).astype("int64")

    # geopandas calcula centróides em coordenadas planares, o que gera aviso
    # de imprecisão no CRS geográfico EPSG:4674. Para H3 res 7 (lado ~2 km),
    # a imprecisão do centróide em lat/lng é irrelevante (<50 m).
    # Suprime o warning computando via representative_point — garantido estar
    # dentro do polígono e mais rápido.
    centroids = gdf.geometry.representative_point()

    uf_pop = 0
    hexes_touched = set()
    for pop, pt in zip(gdf["v0001"].values, centroids):
        if pop <= 0:
            continue
        try:
            h = h3.latlng_to_cell(pt.y, pt.x, H3_RESOLUTION)
        except Exception:
            continue
        uf_map = hex_pop_by_uf.setdefault(h, {})
        uf_map[uf] = uf_map.get(uf, 0) + int(pop)
        uf_pop += int(pop)
        hexes_touched.add(h)

    return {
        "uf": uf,
        "sectors": len(gdf),
        "population": uf_pop,
        "hexes": len(hexes_touched),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--ufs", help="Comma-separated list of UFs to process (default: all)")
    ap.add_argument("--keep-cache", action="store_true", help="Don't delete downloaded GPKGs")
    args = ap.parse_args()

    ufs = [u.strip().upper() for u in args.ufs.split(",")] if args.ufs else UFS
    invalid = [u for u in ufs if u not in UFS]
    if invalid:
        print(f"UFs inválidas: {invalid}", file=sys.stderr)
        return 1

    print(f"HYPR Station — Population H3 ETL")
    print(f"Resolution: H3 res {H3_RESOLUTION} (~5.16 km²/hex)")
    print(f"UFs: {len(ufs)} ({', '.join(ufs)})")
    print()

    hex_pop_by_uf: dict[str, dict[str, int]] = {}
    uf_stats = []

    for i, uf in enumerate(ufs, 1):
        print(f"[{i}/{len(ufs)}] {uf}")
        try:
            gpkg = download_uf(uf)
            stats = process_uf(uf, gpkg, hex_pop_by_uf)
            print(
                f"  [done] {stats['sectors']:,} setores · "
                f"{stats['population']:,} hab · {stats['hexes']:,} hexes"
            )
            uf_stats.append(stats)
            if not args.keep_cache:
                gpkg.unlink(missing_ok=True)
        except Exception as e:
            print(f"  [error] {uf}: {e}", file=sys.stderr)
            continue

    # Reduz hex_pop_by_uf para:
    #   - pop total do hex
    #   - UF dominante do hex (a que contribui com mais pop)
    uf_index: list[str] = []
    uf_to_idx: dict[str, int] = {}
    for uf in UFS:
        uf_to_idx[uf] = len(uf_index)
        uf_index.append(uf)

    sorted_hexes = []
    for h in sorted(hex_pop_by_uf.keys()):
        uf_map = hex_pop_by_uf[h]
        total = sum(uf_map.values())
        dom_uf = max(uf_map.items(), key=lambda kv: kv[1])[0]
        sorted_hexes.append((h, total, uf_to_idx[dom_uf]))

    total_pop = sum(p for _, p, _ in sorted_hexes)
    cross_border_hexes = sum(1 for h in hex_pop_by_uf if len(hex_pop_by_uf[h]) > 1)
    print()
    print(f"Total: {total_pop:,} habitantes em {len(sorted_hexes):,} hexágonos")
    print(f"Hexágonos em fronteira inter-estadual: {cross_border_hexes}")

    # Formato colunar. Três arrays paralelos. Compact, amigável a gzip.
    # u[i] é o índice da UF dominante em ufs[]. Decodificação no JS:
    #   pop = p[i], uf = ufs[u[i]]
    payload = {
        "v": 2,
        "meta": {
            "source": "IBGE Censo Demográfico 2022 — Agregados por Setores Censitários (malha preliminar, atualização 2024-11)",
            "variable": "v0001 (moradores em domicílios particulares permanentes)",
            "resolution": H3_RESOLUTION,
            "hex_area_km2_approx": 5.16,
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "total_population": total_pop,
            "hex_count": len(sorted_hexes),
            "ufs_processed": [s["uf"] for s in uf_stats],
        },
        "ufs": uf_index,
        "h": [h for h, _, _ in sorted_hexes],
        "p": [p for _, p, _ in sorted_hexes],
        "u": [u for _, _, u in sorted_hexes],
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)

    size_mb = OUT_FILE.stat().st_size / 1e6
    print(f"\nSaída: {OUT_FILE} ({size_mb:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
