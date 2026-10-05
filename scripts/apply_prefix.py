#!/usr/bin/env python3
"""Adapte le JS du site au préfixe d'éditeur réel de votre environnement Dataverse.

Les sources utilisent le préfixe `fsjd_`. Si vos tables s'appellent par exemple `craba_fsjd_site`
(préfixe d'éditeur `craba_` + nom saisi `fsjd_site`), lancez :

    python scripts/apply_prefix.py craba_            # colonne principale = craba_fsjd_name
    python scripts/apply_prefix.py craba_ craba_name # si la colonne principale s'appelle craba_name

Résultat : dist/<préfixe>/Inventaire.fr-FR.customjs.js (le fichier à coller dans Power Pages).
"""
import re
import sys
from pathlib import Path

if len(sys.argv) < 2:
    sys.exit(__doc__)
prefix = sys.argv[1] if sys.argv[1].endswith("_") else sys.argv[1] + "_"
name_col = sys.argv[2] if len(sys.argv) > 2 else prefix + "fsjd_name"
root = Path(__file__).resolve().parent.parent
src = root / "site/web-pages/Inventaire/Inventaire.fr-FR.customjs.js"
js = src.read_text(encoding="utf-8")
js = js.replace("fsjd_name", "\0NAME\0")                       # protège la colonne principale
js = re.sub(r"(?<![A-Za-z0-9])fsjd_", prefix + "fsjd_", js)    # tout le reste reçoit le préfixe
js = js.replace("\0NAME\0", name_col)
out = root / "dist" / prefix.rstrip("_")
out.mkdir(parents=True, exist_ok=True)
(out / src.name).write_text(js, encoding="utf-8")
print("écrit :", out / src.name)
