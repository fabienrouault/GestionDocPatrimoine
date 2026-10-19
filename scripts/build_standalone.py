"""Recopie le catalogue data/modeles_documents.csv dans standalone/Inventaire_Patrimoine.html (en place).

Les clés k (S01…, B01…) sont dérivées du niveau et de l'ordre : elles relient les saisies du fichier
inventaire-donnees.json au catalogue. Ne pas renuméroter un document existant ; ajouter les nouveaux à la fin.
Usage : python scripts/build_standalone.py
"""
import csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / 'standalone' / 'Inventaire_Patrimoine.html'

rows = []
with open(ROOT / 'data' / 'modeles_documents.csv', encoding='utf-8-sig', newline='') as f:
    for r in csv.DictReader(f, delimiter=';'):
        n = int(r['ordre'])
        rows.append({'k': ('S' if r['niveau'] == 'Site' else 'B') + f'{n:02d}', 'niveau': r['niveau'], 'n': n,
                     'code': r['code_categorie'], 'cat': r['categorie'], 'libelle': r['libelle']})
js = '[\n' + ',\n'.join('    ' + json.dumps(r, ensure_ascii=False) for r in rows) + '\n  ]'
s = HTML.read_text(encoding='utf-8')
s, nb = re.subn(r'/\*CATALOGUE:debut\*/.*?/\*CATALOGUE:fin\*/', lambda m: '/*CATALOGUE:debut*/' + js + '/*CATALOGUE:fin*/', s, flags=re.S)
assert nb == 1, 'marqueurs CATALOGUE introuvables'
HTML.write_text(s, encoding='utf-8')
print(f'{len(rows)} documents recopiés dans {HTML.relative_to(ROOT)}')
