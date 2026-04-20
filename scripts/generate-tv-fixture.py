#!/usr/bin/env python3
"""
HYPR TV Map — Fixture Generator
Creates public/assets/tv/stations.json and retransmitters.json from a
hand-curated list of major Brazilian TV generators. Runs until the real
ETL (scripts/etl_anatel_tv.py) is wired up and data can be pulled from
the Anatel/Mosaico source.

Usage: python scripts/generate-tv-fixture.py
"""

import json
import os
from datetime import date

OUT_DIR = "public/assets/tv"

# Curated list of major TVD generators — coordinates are approximate
# antenna sites. Authoritative source is the future Anatel Mosaico ETL.
STATIONS = [
    # São Paulo
    ("TVD", "São Paulo", "SP", "13", "5.1", 88.0, 360, "Globo Comunicação e Participações S.A.", "globo", "TV Globo São Paulo", "Licenciada", -23.4569, -46.7622),
    ("TVD", "São Paulo", "SP", "18", "4.1", 52.0, 315, "TV SBT Canal 4 de São Paulo S.A.", "sbt", "SBT São Paulo", "Licenciada", -23.4571, -46.7625),
    ("TVD", "São Paulo", "SP", "22", "7.1", 46.0, 340, "Rádio e Televisão Record S.A.", "record", "Record TV São Paulo", "Licenciada", -23.4576, -46.7628),
    ("TVD", "São Paulo", "SP", "28", "13.1", 40.0, 330, "Rádio e Televisão Bandeirantes Ltda.", "band", "Band São Paulo", "Licenciada", -23.4580, -46.7620),
    ("TVD", "São Paulo", "SP", "36", "9.1", 28.0, 310, "Rede TV S.A.", "redetv", "RedeTV! São Paulo", "Licenciada", -23.4583, -46.7618),
    ("TVD", "São Paulo", "SP", "25", "2.1", 35.0, 305, "Fundação Padre Anchieta", "cultura", "TV Cultura", "Licenciada", -23.4578, -46.7615),
    ("TVD", "São Paulo", "SP", "26", "11.1", 18.0, 280, "Fundação Casper Líbero", "gazeta", "TV Gazeta", "Licenciada", -23.4585, -46.7610),

    # Rio de Janeiro
    ("TVD", "Rio de Janeiro", "RJ", "15", "4.1", 60.0, 290, "Globo Comunicação e Participações S.A.", "globo", "TV Globo Rio de Janeiro", "Licenciada", -22.9306, -43.2509),
    ("TVD", "Rio de Janeiro", "RJ", "21", "5.1", 40.0, 285, "TV SBT Canal 5 do Rio de Janeiro S.A.", "sbt", "SBT Rio", "Licenciada", -22.9310, -43.2513),
    ("TVD", "Rio de Janeiro", "RJ", "32", "7.1", 38.0, 280, "Record TV Rio de Janeiro S.A.", "record", "Record TV Rio", "Licenciada", -22.9308, -43.2511),
    ("TVD", "Rio de Janeiro", "RJ", "34", "13.1", 32.0, 275, "Rádio e Televisão Bandeirantes Ltda.", "band", "Band Rio", "Licenciada", -22.9312, -43.2515),

    # Belo Horizonte
    ("TVD", "Belo Horizonte", "MG", "17", "12.1", 50.0, 220, "TV Globo Minas Ltda.", "globo", "TV Globo Minas", "Licenciada", -19.9317, -43.9317),
    ("TVD", "Belo Horizonte", "MG", "24", "5.1", 22.0, 210, "TV Alterosa S.A.", "sbt", "TV Alterosa", "Licenciada", -19.9320, -43.9320),
    ("TVD", "Belo Horizonte", "MG", "30", "7.1", 18.0, 215, "Record TV Minas Ltda.", "record", "Record TV Minas", "Licenciada", -19.9315, -43.9315),

    # Brasília
    ("TVD", "Brasília", "DF", "17", "10.1", 25.0, 195, "TV Globo Brasília Ltda.", "globo", "TV Globo Brasília", "Licenciada", -15.7906, -47.8919),
    ("TVD", "Brasília", "DF", "13", "2.1", 20.0, 185, "Empresa Brasil de Comunicação S/A", "tvbrasil", "TV Brasil", "Licenciada", -15.7910, -47.8920),

    # Porto Alegre
    ("TVD", "Porto Alegre", "RS", "14", "12.1", 32.0, 240, "Sociedade Rádio Televisão Gaúcha S.A.", "globo", "RBS TV Porto Alegre", "Licenciada", -30.0728, -51.1731),
    ("TVD", "Porto Alegre", "RS", "21", "5.1", 20.0, 230, "TV SBT Canal 5 de Porto Alegre", "sbt", "SBT Rio Grande", "Licenciada", -30.0730, -51.1735),
    ("TVD", "Porto Alegre", "RS", "28", "7.1", 18.0, 225, "Record TV RS S.A.", "record", "Record TV RS", "Licenciada", -30.0732, -51.1729),

    # Curitiba
    ("TVD", "Curitiba", "PR", "15", "12.1", 25.0, 200, "RPC TV Curitiba Ltda.", "globo", "RPC Curitiba", "Licenciada", -25.4048, -49.2578),
    ("TVD", "Curitiba", "PR", "22", "5.1", 15.0, 195, "TV Iguaçu Ltda.", "sbt", "TV Iguaçu", "Licenciada", -25.4050, -49.2580),

    # Salvador
    ("TVD", "Salvador", "BA", "15", "11.1", 28.0, 180, "TV Bahia S.A.", "globo", "TV Bahia", "Licenciada", -12.9704, -38.5015),
    ("TVD", "Salvador", "BA", "22", "4.1", 20.0, 175, "TV Aratu S.A.", "sbt", "TV Aratu", "Licenciada", -12.9706, -38.5018),
    ("TVD", "Salvador", "BA", "30", "7.1", 18.0, 170, "Record TV Itapoan S.A.", "record", "Record TV Itapoan", "Licenciada", -12.9702, -38.5013),

    # Recife
    ("TVD", "Recife", "PE", "17", "12.1", 25.0, 165, "TV Globo Nordeste Ltda.", "globo", "TV Globo Nordeste", "Licenciada", -8.0109, -34.9300),
    ("TVD", "Recife", "PE", "24", "4.1", 18.0, 160, "TV Jornal do Commercio Ltda.", "sbt", "TV Jornal", "Licenciada", -8.0111, -34.9302),

    # Fortaleza
    ("TVD", "Fortaleza", "CE", "15", "10.1", 22.0, 155, "TV Verdes Mares Ltda.", "globo", "TV Verdes Mares", "Licenciada", -3.7429, -38.5433),
    ("TVD", "Fortaleza", "CE", "22", "4.1", 16.0, 150, "TV Diário Ltda.", "sbt", "TV Cidade", "Licenciada", -3.7431, -38.5435),

    # Goiânia
    ("TVD", "Goiânia", "GO", "13", "10.1", 20.0, 145, "TV Anhanguera Ltda.", "globo", "TV Anhanguera", "Licenciada", -16.6799, -49.2550),

    # Belém
    ("TVD", "Belém", "PA", "13", "2.1", 18.0, 140, "TV Liberal Ltda.", "globo", "TV Liberal", "Licenciada", -1.4558, -48.4902),

    # Manaus
    ("TVD", "Manaus", "AM", "16", "5.1", 18.0, 135, "Rede Amazônica de Rádio e Televisão Ltda.", "globo", "Rede Amazônica Manaus", "Licenciada", -3.1190, -60.0217),

    # Campo Grande
    ("TVD", "Campo Grande", "MS", "13", "6.1", 16.0, 130, "TV Morena Ltda.", "globo", "TV Morena", "Licenciada", -20.4697, -54.6201),

    # Vitória
    ("TVD", "Vitória", "ES", "13", "4.1", 18.0, 120, "TV Gazeta Ltda.", "globo", "TV Gazeta ES", "Licenciada", -20.3155, -40.3128),

    # Florianópolis
    ("TVD", "Florianópolis", "SC", "17", "12.1", 20.0, 125, "TV Barriga Verde Ltda.", "globo", "NSC TV Florianópolis", "Licenciada", -27.5954, -48.5480),

    # Natal
    ("TVD", "Natal", "RN", "14", "6.1", 14.0, 110, "Inter TV Cabugi Ltda.", "globo", "Inter TV Cabugi", "Licenciada", -5.7945, -35.2110),

    # João Pessoa
    ("TVD", "João Pessoa", "PB", "15", "10.1", 15.0, 115, "TV Cabo Branco Ltda.", "globo", "TV Cabo Branco", "Licenciada", -7.1195, -34.8450),

    # Maceió
    ("TVD", "Maceió", "AL", "13", "5.1", 15.0, 108, "TV Gazeta de Alagoas Ltda.", "globo", "TV Gazeta AL", "Licenciada", -9.6658, -35.7353),

    # Teresina
    ("TVD", "Teresina", "PI", "13", "8.1", 12.0, 100, "TV Clube de Teresina Ltda.", "globo", "TV Clube Teresina", "Licenciada", -5.0892, -42.8019),

    # Aracaju
    ("TVD", "Aracaju", "SE", "13", "4.1", 14.0, 105, "TV Sergipe Ltda.", "globo", "TV Sergipe", "Licenciada", -10.9472, -37.0731),

    # São Luís
    ("TVD", "São Luís", "MA", "13", "10.1", 14.0, 110, "TV Mirante Ltda.", "globo", "TV Mirante", "Licenciada", -2.5391, -44.2829),

    # Cuiabá
    ("TVD", "Cuiabá", "MT", "13", "2.1", 15.0, 120, "Centro América Radiodifusão Ltda.", "globo", "TV Centro América", "Licenciada", -15.6014, -56.0979),

    # Palmas
    ("TVD", "Palmas", "TO", "14", "10.1", 12.0, 95, "TV Anhanguera Tocantins Ltda.", "globo", "TV Anhanguera TO", "Licenciada", -10.1689, -48.3317),

    # Porto Velho
    ("TVD", "Porto Velho", "RO", "13", "5.1", 12.0, 95, "Rede Amazônica Porto Velho", "globo", "Rede Amazônica PV", "Licenciada", -8.7612, -63.9039),

    # Rio Branco
    ("TVD", "Rio Branco", "AC", "13", "5.1", 10.0, 90, "Rede Amazônica Acre", "globo", "Rede Amazônica AC", "Licenciada", -9.9747, -67.8243),

    # Macapá
    ("TVD", "Macapá", "AP", "13", "6.1", 10.0, 90, "TV Amapá Ltda.", "globo", "TV Equinócio", "Licenciada", 0.0349, -51.0694),

    # Boa Vista
    ("TVD", "Boa Vista", "RR", "13", "10.1", 8.0, 85, "Rede Amazônica Roraima", "globo", "Rede Amazônica RR", "Licenciada", 2.8235, -60.6758),
]

FIELDS = [
    "tipo", "municipio", "uf", "canal", "canal_virtual",
    "erp_kw", "altura_antena",
    "entidade", "rede_id", "nome_fantasia", "status",
    "lat", "lng",
]

LOOKUP_KEYS = [
    "T", "M", "U", "C", "V",
    None, None,
    "E", "R", "F", "S",
    None, None,
]


def build_compact(rows):
    lookups = {k: [] for k in set(filter(None, LOOKUP_KEYS))}
    lookup_idx = {k: {} for k in lookups.keys()}

    data = []
    for row in rows:
        compact = []
        for value, key in zip(row, LOOKUP_KEYS):
            if key is None:
                compact.append(value)
            else:
                s = str(value) if value is not None else ""
                if s not in lookup_idx[key]:
                    lookup_idx[key][s] = len(lookups[key])
                    lookups[key].append(s)
                compact.append(lookup_idx[key][s])
        data.append(compact)

    return {
        "_meta": {
            "generated": date.today().isoformat(),
            "source": "fixture/manual-curation",
            "count": len(rows),
        },
        "_L": lookups,
        "_D": data,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    generators_compact = build_compact(STATIONS)
    out_stations = os.path.join(OUT_DIR, "stations.json")
    with open(out_stations, "w", encoding="utf-8") as f:
        json.dump(generators_compact, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✓ Wrote {len(STATIONS)} generators to {out_stations}")

    empty_compact = build_compact([])
    empty_compact["_meta"]["source"] = "fixture/empty"
    out_rtv = os.path.join(OUT_DIR, "retransmitters.json")
    with open(out_rtv, "w", encoding="utf-8") as f:
        json.dump(empty_compact, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✓ Wrote empty RTV fixture to {out_rtv}")


if __name__ == "__main__":
    main()
