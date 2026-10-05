# Accès, rôles et autorisations

## 1. Authentification (interne uniquement)
*Power Pages → Configurer → Fournisseurs d'identité* : activez **Microsoft Entra ID** (tenant de la Fondation) et **désactivez
l'inscription locale** (*Paramètres du site* : `Authentication/Registration/LocalLoginEnabled = false`,
`Authentication/Registration/Enabled = false`, `Authentication/Registration/OpenRegistrationEnabled = false`).
Ainsi seuls les comptes professionnels peuvent se connecter ; un contact Dataverse est associé à chaque utilisateur
(invitation depuis *Power Pages → Contacts*, ou rapprochement par e-mail).

Visibilité du site : *Paramètres → Visibilité* = **Privé** (accès limité aux membres du tenant) tant que la mise en production n'est pas décidée.

## 2. Rôles web
| Rôle web | Pour qui | Portée |
|---|---|---|
| `Responsable technique` | Responsables techniques territoriaux **et** responsables techniques d'établissement | Lecture/écriture selon leurs affectations (§3) |
| `Pilotage FSJD` | Siège, direction patrimoine | Lecture de **tous** les établissements (nom exact testé par la page) |

Les rôles se rattachent aux contacts. Rôle `Authenticated Users` : aucun droit sur les tables `fsjd_*`.
La différence territorial / établissement ne vient **pas** du rôle mais de l'affectation (relations N:N de `docs/modele-donnees.md`) :
- territorial → relié à un ou plusieurs **territoires** : voit tous leurs établissements ;
- établissement → relié à un ou plusieurs **établissements** : ne voit que ceux-là.

## 3. Autorisations de table (rôle `Responsable technique`)
Les autorisations s'additionnent : la personne voit l'union de ses établissements « par territoire » et « par établissement ».
Deux chaînes d'accès sont donc créées, chacune avec sa propre racine :

**Chaîne A – par territoire**
| Autorisation | Portée | Droits |
|---|---|---|
| `fsjd_territoire` (A) | **Contact**, relation `fsjd_territoire_contact` | Lecture |
| `fsjd_site` (A) | **Parent** de « `fsjd_territoire` (A) », relation `fsjd_territoire` | Lecture, Écriture |
| `fsjd_batiment`, `fsjd_documentinventaire`, `fsjd_contrat` (A) | **Parent** de « `fsjd_site` (A) », relation `fsjd_site` | Lecture, Écriture, Création, Ajout, Ajout à (+ Suppression pour `fsjd_contrat`) |

**Chaîne B – par établissement**
| Autorisation | Portée | Droits |
|---|---|---|
| `fsjd_site` (B) | **Contact**, relation `fsjd_site_contact` | Lecture, Écriture |
| `fsjd_batiment`, `fsjd_documentinventaire`, `fsjd_contrat` (B) | **Parent** de « `fsjd_site` (B) », relation `fsjd_site` | mêmes droits que ci-dessus |

**Référentiels** (tous rôles) : une autorisation distincte **Global – Lecture** sur `fsjd_modeledocument` et sur `fsjd_territoire`
(le site affiche le nom du territoire de chaque établissement). Elle s'ajoute à « `fsjd_territoire` (A) », qui ne sert que de racine
à la chaîne A : ne pas la passer en Global, sinon chaque territorial verrait tous les territoires.

**Pilotage FSJD** : Global – Lecture sur les 6 tables, Global – Écriture sur `fsjd_site`.

Création/rattachement des établissements et affectation des personnes : par l'équipe Patrimoine dans l'application pilotée
par modèle (Dataverse), pas depuis le portail.

## 4. API Web (paramètres du site)
Ajoutez, pour **chacune** des 6 tables `fsjd_*` (remplacer `<table>` par le nom logique) :

| Nom | Valeur |
|---|---|
| `Webapi/<table>/enabled` | `true` |
| `Webapi/<table>/fields` | `*` (ou la liste explicite des colonnes, y compris la colonne fichier) |

Les droits réels restent ceux des autorisations de table : l'API ne permet de lire/écrire que ce que le rôle autorise.
Réglage conseillé : `Site/EnableCustomErrors = false` uniquement en recette, pour lire les messages d'erreur de l'API.

## 5. Contrôle d'accès aux pages
Pages `Inventaire` : ajouter une **règle de contrôle d'accès de page** (*Restreindre la lecture*) limitée aux rôles
`Responsable technique` et `Pilotage FSJD`. La page `Accueil` peut rester publique (aucune donnée) ou être restreinte aussi.
