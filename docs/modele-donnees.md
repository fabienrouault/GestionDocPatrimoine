# Modèle de données Dataverse

> **Préfixe d'éditeur.** Dataverse ajoute automatiquement le préfixe de votre éditeur devant chaque nom saisi
> (ex. `craba_` → `craba_fsjd_site`). Les sources utilisent `fsjd_` ; avant de coller le JS dans Power Pages, lancez
> `python scripts/apply_prefix.py craba_` (remplacez `craba_` par votre préfixe) et utilisez le fichier généré dans `dist/`.
> Si la colonne principale de vos tables ne s'appelle pas `<préfixe>fsjd_name` (ex. `craba_name`), ajoutez-la en 2ᵉ argument.
> Un fichier prêt à l'emploi pour le préfixe `craba_` est fourni : `dist/craba/`.

> **Colonnes de recherche (liens 1-N).** Créer une colonne *Recherche* sur la table enfant **crée déjà** la relation 1-N :
> ne créez pas en plus la relation depuis le panneau *Relations* (erreur « An attribute with the specified name … already exists »).
> Exemple : pour lier Établissement → Territoire, ajoutez la colonne `fsjd_territoire` de type Recherche dans `fsjd_site`, et c'est tout.
> Seules les relations **plusieurs-à-plusieurs** (avec `contact`) se créent depuis *Relations → Ajouter une relation → Plusieurs-à-plusieurs*.

Préfixe d'éditeur utilisé dans la suite : **`fsjd`**. Les noms ci-dessous sont des **noms logiques / de schéma en minuscules** : saisissez-les à
l'identique à la création (le code du site les utilise tels quels, y compris pour les liaisons `@odata.bind`).
Créez les tables dans [make.powerapps.com](https://make.powerapps.com) → *Tables* (ou demandez à Copilot / au *Plan designer* de
Power Pages de les générer à partir de ce document).

Les valeurs des listes de choix commencent à **100000000** et suivent l'ordre indiqué (100000000, 100000001, …).

## Tables

| Table (nom logique) | Nom d'ensemble (API) | Rôle |
|---|---|---|
| `fsjd_territoire` | `fsjd_territoires` | Territoires de la Fondation |
| `fsjd_site` | `fsjd_sites` | Établissements (un par site audité) |
| `fsjd_batiment` | `fsjd_batiments` | Bâtiments d'un établissement |
| `fsjd_modeledocument` | `fsjd_modeledocuments` | Catalogue des documents à collecter (issu de l'Excel) |
| `fsjd_documentinventaire` | `fsjd_documentinventaires` | Une ligne par document attendu et par site/bâtiment |
| `fsjd_contrat` | `fsjd_contrats` | Contrats d'énergie et de maintenance d'un bâtiment |

> Si Dataverse génère un nom d'ensemble différent (pluriel irrégulier), corrigez l'objet `SET` en tête de
> `Inventaire.fr-FR.customjs.js`.

### `fsjd_territoire`
`fsjd_name` (texte, colonne principale).

### Affectation des personnes (plusieurs par établissement)
Deux relations **plusieurs-à-plusieurs** avec la table `contact`, qui pilotent les droits :
- `fsjd_territoire_contact` (Territoire ↔ Contact) : **responsables techniques territoriaux** → accès à *tous* les établissements du territoire.
- `fsjd_site_contact` (Établissement ↔ Contact) : **responsables techniques d'établissement** (et tout autre contributeur) → accès à *cet* établissement seulement.

Un établissement peut ainsi avoir autant de déposants que nécessaire ; une personne peut aussi cumuler les deux niveaux.

### `fsjd_site`
| Colonne | Type | Remarque |
|---|---|---|
| `fsjd_name` | Texte (principale) | Nom du site |
| `fsjd_territoire` | Recherche → `fsjd_territoire` | |
| `fsjd_adresse` | Texte | |
| `fsjd_contactdirection`, `fsjd_contacttechnique` | Texte | « NOM Prénom - téléphone - mail » |
| `fsjd_activites` | Texte multiligne | |
| `fsjd_etatpatrimoine` | Choix | Propriétaire, Locataire |
| `fsjd_anneeacquisition`, `fsjd_nbplacesstationnement` | Entier | |
| `fsjd_superficieterrain`, `fsjd_superficiebatiments`, `fsjd_superficiestationnements` | Décimal | m² |

### `fsjd_batiment`
| Colonne | Type |
|---|---|
| `fsjd_name` | Texte (principale) |
| `fsjd_site` | Recherche → `fsjd_site` (obligatoire) |
| `fsjd_activites` | Texte multiligne |
| `fsjd_statutoccupation` | Choix : Propriétaire, Locataire, Mise à disposition, Copropriété, Crédit-bail, Autre |
| `fsjd_anneeconstruction`, `fsjd_nbetages`, `fsjd_effectifadmissible`, `fsjd_nblits` | Entier |
| `fsjd_superficieterrain`, `fsjd_superficiebatiment`, `fsjd_hauteurplancherbas` | Décimal |
| `fsjd_statutetablissement` | Choix : ERP, HAB, ERT, ICPE, Autres, Non concerné |
| `fsjd_typeerp` | Texte (J, L, R, U, W…) |
| `fsjd_categorieerp` | Choix : 1ère, 2ème, 3ème, 4ème, 5ème, Non concerné |

### `fsjd_modeledocument` (catalogue, rempli une fois)
`fsjd_name` (libellé, principale) · `fsjd_niveau` (Choix : **Site** = 100000000, **Bâtiment** = 100000001) ·
`fsjd_categorie` (Texte) · `fsjd_ordre` (Entier).
Données prêtes à importer : [`data/modeles_documents.csv`](../data/modeles_documents.csv) (11 documents *Site* + 46 *Bâtiment*,
extraits du classeur d'audit). Importer via *Tables → fsjd_modeledocument → Importer → Importer des données à partir d'Excel/CSV*
(séparateur `;`, encodage UTF-8) en associant `libelle→fsjd_name`, `niveau→fsjd_niveau`, `categorie→fsjd_categorie`,
`ordre→fsjd_ordre`. Pour ajouter/retirer un document attendu plus tard, il suffit de modifier cette table : aucune mise à jour du site.

### `fsjd_documentinventaire`
| Colonne | Type | Remarque |
|---|---|---|
| `fsjd_name` | Texte (principale) | Reprend le libellé du modèle |
| `fsjd_site` | Recherche → `fsjd_site` | toujours renseigné |
| `fsjd_batiment` | Recherche → `fsjd_batiment` | vide pour un document de niveau *Site* |
| `fsjd_modele` | Recherche → `fsjd_modeledocument` | |
| `fsjd_statut` | Choix : Disponible, Obsolète/partiel, Manquant, Non applicable | Absence de ligne = « À renseigner » |
| `fsjd_datedocument` | Date seule | |
| `fsjd_priorite` | Choix : Haute, Moyenne, Basse, Non applicable | |
| `fsjd_commentaire` | Texte (500) | |
| `fsjd_modifiepar` | Texte (200) | nom de la dernière personne ayant modifié la ligne (renseigné par le site) |
| `fsjd_modifiepar` | Texte (200) | nom de la dernière personne ayant modifié la ligne (renseigné par le site) |
| `fsjd_fichier` | **Fichier** (taille max 128 Mo conseillée) | déposé depuis le site |
| `fsjd_lien` | URL | renseigné par le flux Power Automate (lien SharePoint/Teams) |

Les lignes sont créées **à la demande** par le site (au premier changement de statut, date, commentaire ou dépôt de fichier) :
inutile de pré-générer 57 lignes par bâtiment.

### `fsjd_contrat`
`fsjd_name` (principale) · `fsjd_site`, `fsjd_batiment` (Recherche) ·
`fsjd_famille` (Choix, 14 valeurs dans cet ordre : Électricité, Gaz, Fuel, Eau potable, Téléphonie / Internet — *énergie* ;
CVC, Plomberie, Électricité courants forts (CFO), Électricité courants faibles (Cfa), Systèmes de sécurité incendie (SSI),
Appareils élévateurs, Gestion technique du bâtiment (GTB), Portes et portails, Autres — *maintenance*) ·
`fsjd_nature`, `fsjd_fournisseur` (fournisseur ou prestataire), `fsjd_reconduction`, `fsjd_equipements`, `fsjd_criticite`, `fsjd_modifiepar` (Texte) ·
`fsjd_echeance` (Date seule) · `fsjd_fichier` (Fichier) · `fsjd_lien` (URL).

### Table `contact` (existante)
Aucune colonne à ajouter : l'affectation passe par les deux relations N:N ci-dessus.
En cas de modifications simultanées de la même ligne par deux personnes, la dernière enregistrée l'emporte (champ par champ).

## Correspondance avec le classeur Excel

| Onglet « SITE 1 » | Dans l'application |
|---|---|
| Lignes `SIT/GEN`, `BAT/GEN` (informations générales) | Colonnes de `fsjd_site` / `fsjd_batiment` (formulaire en haut de page) |
| Lignes `SIT/ADM, PLN, DIA`, `BAT/PLN, SEC, DIA, RAP` (colonnes statut, date, priorité) | Lignes de `fsjd_documentinventaire` ← catalogue `fsjd_modeledocument` |
| Lignes `BAT/ENE` et `BAT/EXP` (contrats) | Lignes de `fsjd_contrat`, regroupées par famille |
| Listes de validation (statut, priorité) | Colonnes de choix |

Le script [`scripts/extract_catalogue.py`](../scripts/extract_catalogue.py) régénère les CSV si le classeur évolue.
