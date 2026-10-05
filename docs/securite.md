# Accès, rôles et autorisations

## 1. Authentification (interne uniquement)
*Power Pages → Configurer → Fournisseurs d'identité* : activez **Microsoft Entra ID** (tenant de la Fondation) et **désactivez
l'inscription locale** (*Paramètres du site* : `Authentication/Registration/LocalLoginEnabled = false`,
`Authentication/Registration/Enabled = false`, `Authentication/Registration/OpenRegistrationEnabled = false`).
Ainsi seuls les comptes professionnels peuvent se connecter ; un contact Dataverse est associé à chaque utilisateur
(invitation depuis *Power Pages → Contacts*, ou rapprochement par e-mail).

Visibilité du site : *Paramètres → Visibilité* = **Privé** (accès limité aux membres du tenant) tant que la mise en production n'est pas décidée.

## 2. Rôles web
| Rôle web | Pour qui | Droits |
|---|---|---|
| `Responsable technique` | Responsables techniques territoriaux | Lecture/écriture sur **leurs** établissements |
| `Pilotage FSJD` | Siège, direction patrimoine | Lecture de **tous** les établissements (le nom exact `Pilotage FSJD` est testé par la page) |

Les deux rôles doivent être rattachés aux contacts concernés. Rôle `Authenticated Users` : aucun droit sur les tables `fsjd_*`.

## 3. Autorisations de table
| Table | Responsable technique | Pilotage FSJD |
|---|---|---|
| `fsjd_territoire`, `fsjd_modeledocument` | Global — Lecture | Global — Lecture |
| `fsjd_site` | **Contact** (relation `fsjd_responsable`) — Lecture, Écriture | Global — Lecture, Écriture |
| `fsjd_batiment` | **Parent** de `fsjd_site` (relation `fsjd_site`) — Lecture, Écriture, Création, Ajout, Ajout à | Global — Lecture |
| `fsjd_documentinventaire` | **Parent** de `fsjd_site` (relation `fsjd_site`) — Lecture, Écriture, Création, Ajout, Ajout à | Global — Lecture |
| `fsjd_contrat` | **Parent** de `fsjd_site` (relation `fsjd_site`) — Lecture, Écriture, Création, Suppression, Ajout, Ajout à | Global — Lecture |

Création/rattachement des établissements et affectation du responsable : par l'équipe Patrimoine dans l'application pilotée
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
