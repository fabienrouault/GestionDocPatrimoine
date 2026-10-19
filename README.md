# Inventaire documentaire du patrimoine – Fondation Saint Jean de Dieu

Site **Power Pages interne** permettant à chaque responsable technique territorial de recenser, pour chacun de ses
établissements et bâtiments, les documents du classeur `FSJD_Audit_des_sites` (statut, date, priorité, commentaire),
les contrats d'énergie et de maintenance (fournisseur, échéance…), et de **déposer les fichiers** dans un dossier **Teams** partagé.

Par rapport au premier site (orienté « vitrine client ») : plus de pages marketing, accès réservé aux comptes professionnels,
un seul outil de saisie et un tableau d'avancement.

## Version autonome (sans Power Pages)
`standalone/Inventaire_Patrimoine.html` : la même application dans **un seul fichier HTML**, à ouvrir par double-clic
(Chrome ou Edge), sans serveur ni compte. Le responsable technique prépare l'inventaire sur son ordinateur :
- au premier lancement, il choisit un **dossier** (local, ou Teams / OneDrive synchronisé) ; tout y est enregistré automatiquement :
  ```
  inventaire-donnees.json            saisies (établissements, bâtiments, statuts, dates, commentaires, contrats)
  inventaire-donnees.backup.json     état avant la 1re écriture de la session
  sauvegardes/                       une copie par jour (10 jours) + copies en cas de conflit
  fichiers/<Établissement>/_Site/<Catégorie>/<NN - Document>/…
  fichiers/<Établissement>/<Bâtiment>/<Catégorie>/<NN - Document>/…
  fichiers/<Établissement>/<Bâtiment>/Contrats/<Énergie | Maintenance>/<Famille>/…
  corbeille/<date>/…                 fichiers retirés (jamais supprimés définitivement)
  ```
- dépôt de fichiers par bouton ou glisser-déposer sur la ligne ; renommer un établissement ou un bâtiment range ses fichiers dans le nouveau dossier ;
- menu ☰ : **export en dossier compressé (.zip)** (tout l'inventaire, ou un établissement depuis sa fiche) contenant le JSON,
  les fichiers, deux synthèses CSV (documents, contrats), l'outil HTML et un LISEZMOI ; **import d'un .zip** (ajout ou remplacement) ;
  vérification de la présence des fichiers ;
- si le fichier de données est modifié ailleurs (autre poste, synchronisation), l'enregistrement est suspendu et l'outil demande
  quelle version garder (l'autre est copiée dans `sauvegardes/`) ;
- Firefox / Safari (pas d'accès aux dossiers) : les données restent dans le navigateur, à exporter en .zip.

Le catalogue des documents est recopié de `data/modeles_documents.csv` par `python scripts/build_standalone.py` (clés `S01…`, `B01…`
liées aux saisies : ne pas renuméroter les documents existants). Test : `PLAYWRIGHT_PATH=<module playwright> node tests/standalone.js`.

## Contenu du dépôt
| Chemin | Rôle |
|---|---|
| `site/web-pages/Inventaire/` | Application de saisie (HTML + CSS + JS) – page `/inventaire/` |
| `site/web-pages/Accueil/` | Page d'accueil interne (remplace l'ancienne) |
| `site/content-snippets/` | Nom du site, pied de page |
| `docs/modele-donnees.md` | Tables et colonnes Dataverse à créer |
| `docs/securite.md` | Authentification Entra ID, rôles, autorisations de table, API Web |
| `docs/depot-teams.md` | Flux Power Automate vers le dossier Teams |
| `data/*.csv` | Catalogue extrait de l'Excel (57 documents, 24 champs, 14 familles de contrats) |
| `scripts/extract_catalogue.py` | Régénère les CSV depuis le classeur |
| `standalone/Inventaire_Patrimoine.html` | Version autonome (fichier HTML unique, dossier local + export .zip) |
| `scripts/build_standalone.py` | Recopie le catalogue CSV dans la version autonome |
| `tests/` | Faux serveur Power Pages + tests de bout en bout (Playwright), dont `standalone.js` |

## Mise en service (ordre conseillé)
1. **Dataverse** (si votre préfixe d'éditeur n'est pas vide, voir `scripts/apply_prefix.py` ; version `craba_` fournie dans `dist/craba/`) : créer les 6 tables selon `docs/modele-donnees.md`, importer `data/modeles_documents.csv`,
   créer les territoires et les établissements puis affecter les personnes : territoriaux ↔ territoires, responsables d'établissement ↔ établissements (relations N:N, plusieurs personnes possibles par établissement).
2. **Site Power Pages** : dans le studio de conception, créer la page **Inventaire** (URL partielle `inventaire`, modèle de page
   *Default studio template*) et coller le contenu des 3 fichiers `Inventaire.fr-FR.*` (éditeur de code → HTML / CSS / JS).
   Remplacer le HTML de **Accueil** et les extraits de contenu `Site name` / `Footer`. Supprimer les pages `Ressources Techniques`,
   `Maintenance`, `Rechercher` du menu *Default* et ajouter *Inventaire*.
   (L'archive transmise ne contenait pas les fichiers `.yml` de métadonnées du dépôt PAC ; c'est pourquoi les pages sont
   livrées en simple copier-coller. Si vous les ré-exportez avec `pac pages download`, les fichiers ci-dessus se placent tels quels.)
3. **Sécurité** : suivre `docs/securite.md` (Entra ID, rôles web, autorisations de table, paramètres `Webapi/…`).
4. **Teams** : créer le flux de `docs/depot-teams.md`.
5. **Recette** : se connecter avec un compte responsable (ne voit que ses établissements) puis avec un compte *Pilotage FSJD*.

## Fonctionnement
- `#/` Liste des établissements groupés par territoire, avancement, alertes (manquants, fichiers à déposer), **export CSV** de la synthèse.
- `#/site/<id>` Informations générales + bâtiments (ajout) + documents du site.
- `#/batiment/<id>` Informations générales + documents par catégorie + contrats par famille (alerte d'échéance à 90 jours).
- Enregistrement automatique à chaque modification ; un document est « traité » dès qu'un statut est choisi.
- Dépôt de fichier : extensions autorisées et taille max (50 Mo) réglables en tête du JS.

## Tests
```
PLAYWRIGHT_PATH=<chemin du module playwright> node tests/e2e.js
```
Vérifie contre un faux serveur : création paresseuse des lignes, absence de doublon, dépôt de fichier, contrats, ajout de bâtiment,
export CSV, absence d'erreur JavaScript.

## Limites connues – à valider dans votre environnement
Je n'ai **pas pu tester sur un vrai tenant Power Pages** ; le test ci-dessus s'appuie sur un simulateur de l'API.
Points à confirmer en recette : (1) dépôt de fichier via `PUT /_api/<table>(id)/fsjd_fichier` (colonne Fichier de l'API Web) et
taille maximale acceptée ; (2) noms d'ensemble des tables (`SET` dans le JS) ; (3) liste `Webapi/<table>/fields`
(`*` recommandé au départ) ; (4) rôle `Pilotage FSJD` reconnu par `user.roles`.
