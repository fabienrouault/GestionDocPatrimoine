#!/usr/bin/env python3
"""Extrait le catalogue des éléments à collecter depuis le classeur d'audit FSJD.

Sortie (dossier data/) :
  champs_informations.csv   champs d'information générale (site / bâtiment)
  modeles_documents.csv     documents attendus (niveau Site ou Bâtiment)
  familles_contrats.csv     familles de contrats (énergie / maintenance)

Usage : python scripts/extract_catalogue.py [classeur.xlsx]
"""
import csv
import re
import sys
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "FSJD_Audit_des_sites_2026.08.28.xlsx"
OUT = ROOT / "data"
TODO = "*à compléter"

CATEGORIES = {
    ("SIT", "GEN"): "Informations générales du site",
    ("SIT", "ADM"): "Propriété et conformité administrative",
    ("SIT", "PLN"): "Plans",
    ("SIT", "DIA"): "Diagnostics de site",
    ("BAT", "GEN"): "Informations générales du bâtiment",
    ("BAT", "PLN"): "Plans - Dossier des Ouvrages Exécutés",
    ("BAT", "SEC"): "Dossier Sécurité",
    ("BAT", "DIA"): "Diagnostics du bâtiment",
    ("BAT", "RAP"): "Contrôles périodiques des installations",
    ("BAT", "ENE"): "Fournitures d'énergie(s) / Abonnements",
    ("BAT", "EXP"): "Contrats d'exploitation / Maintenance",
}


def clean(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def main():
    ws = openpyxl.load_workbook(SRC)["SITE 1"]
    infos, docs, familles = [], [], []
    group = ""  # sous-titre courant (ex. famille de contrat)
    n = {"SIT": 0, "BAT": 0}
    for row in ws.iter_rows(min_row=4, max_col=6, values_only=True):
        niv, cat, lib, d, e, f = (clean(c) for c in row)
        if not niv or not lib:
            continue
        key = (niv, cat)
        if key not in CATEGORIES or lib.startswith(TODO):
            continue
        titre_section = lib in ("LE SITE", "LES BATIMENTS", CATEGORIES[key]) or lib == "Contrôles Périodiques des Installations"
        if titre_section:
            continue
        niveau = "Site" if niv == "SIT" else "Bâtiment"
        if cat == "GEN":
            aide = d.replace(TODO, "").strip(" ()")
            infos.append(dict(niveau=niveau, libelle=lib, aide=aide))
        elif cat in ("ENE", "EXP"):
            if lib.lower().startswith(("fournitures d'energie", "contrats d'exploitation")):
                continue                              # titre de section, pas une famille
            if not d and not e:                       # en-tête de famille (Electricité, CVC...)
                group = lib
                familles.append(dict(type="Énergie" if cat == "ENE" else "Maintenance", famille=lib))
            # lignes "Nature du contrat..." / "*à compléter" / "Criticité..." = gabarit du tableau
        else:
            if not d and not e and not f:             # en-tête de section interne
                continue
            if lib.startswith("Plans et Synoptiques"):
                group = "Synoptiques"
                continue
            if lib.startswith("- "):
                lib = f"Synoptique – {lib[2:]}"
            n[niv] += 1
            docs.append(dict(niveau=niveau, categorie=CATEGORIES[key], code_categorie=cat,
                             libelle=lib, ordre=n[niv]))

    def dump(name, rows):
        with open(OUT / name, "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]), delimiter=";")
            w.writeheader()
            w.writerows(rows)
        print(f"{name}: {len(rows)} lignes")

    dump("champs_informations.csv", infos)
    dump("modeles_documents.csv", docs)
    dump("familles_contrats.csv", familles)


if __name__ == "__main__":
    main()
