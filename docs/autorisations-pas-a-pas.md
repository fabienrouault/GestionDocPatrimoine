# Autorisations de table – pas à pas

Objectif : un responsable technique ne voit et ne modifie que les établissements qui le concernent. Remplacez `craba_` par votre préfixe.

## Avant de commencer
1. **Rôles web** (*Power Pages → Configurer → Sécurité → Rôles web → + Nouveau rôle*) : créez `Responsable technique` et `Pilotage FSJD`
   (ne cochez ni « Utilisateurs authentifiés » ni « Utilisateurs anonymes »).
2. **Relations** déjà créées : `fsjd_territoire` ↔ `contact` (N:N), `fsjd_site` ↔ `contact` (N:N), et les colonnes de recherche des tables enfants.
   Notez le **nom** de chaque relation (table → *Relations*) : vous les choisirez dans les listes ci-dessous.

## Où créer une autorisation
*Power Pages → Configurer → Sécurité → Autorisations de table → + Nouvelle autorisation*, puis renseignez :
**Nom**, **Table**, **Type d'accès**, **Relation** (si le type n'est pas Global), **Privilèges**, puis **+ Rôles web** (ajouter le rôle).
Pour une **autorisation enfant**, ouvrez l'autorisation parent et cliquez **+ Autorisation enfant** (type d'accès *Parent* automatique) :
choisissez la table, la relation vers le parent et les privilèges.
Pensez à **enregistrer** chaque autorisation. Un enfant hérite des rôles du parent : n'ajoutez les rôles qu'à la racine.

Abréviations des privilèges : **L** Lire · **É** Écrire · **C** Créer · **S** Supprimer · **A** Ajouter · **AÀ** Ajouter à.
(« Ajouter » / « Ajouter à » sont nécessaires pour relier un enregistrement à un autre, ex. rattacher un document à un bâtiment.)

## 1. Référentiels (lecture pour tous)
| Nom | Table | Accès | Privilèges | Rôles |
|---|---|---|---|---|
| Modèles de documents – lecture | `craba_fsjd_modeledocument` | Global | L, AÀ | Responsable technique, Pilotage FSJD |
| Territoires – lecture | `craba_fsjd_territoire` | Global | L | Responsable technique, Pilotage FSJD |

## 2. Responsables **d'établissement** (chaîne B – la plus simple, commencez par elle)
| Nom | Table | Accès | Relation | Privilèges | Rôle |
|---|---|---|---|---|---|
| Site – par contact | `craba_fsjd_site` | **Contact** | relation N:N site ↔ contact | L, É, AÀ | Responsable technique |
| ↳ enfant : Bâtiments | `craba_fsjd_batiment` | Parent | `craba_fsjd_site` | L, É, C, A, AÀ | (hérité) |
| ↳ enfant : Documents | `craba_fsjd_documentinventaire` | Parent | `craba_fsjd_site` | L, É, C, A | (hérité) |
| ↳ enfant : Contrats | `craba_fsjd_contrat` | Parent | `craba_fsjd_site` | L, É, C, S, A | (hérité) |

## 3. Responsables **territoriaux** (chaîne A)
| Nom | Table | Accès | Relation | Privilèges | Rôle |
|---|---|---|---|---|---|
| Territoire – par contact | `craba_fsjd_territoire` | **Contact** | relation N:N territoire ↔ contact | L | Responsable technique |
| ↳ enfant : Sites | `craba_fsjd_site` | Parent | `craba_fsjd_territoire` | L, É, AÀ | (hérité) |
| ↳↳ enfant de « Sites » : Bâtiments | `craba_fsjd_batiment` | Parent | `craba_fsjd_site` | L, É, C, A, AÀ | (hérité) |
| ↳↳ enfant de « Sites » : Documents | `craba_fsjd_documentinventaire` | Parent | `craba_fsjd_site` | L, É, C, A | (hérité) |
| ↳↳ enfant de « Sites » : Contrats | `craba_fsjd_contrat` | Parent | `craba_fsjd_site` | L, É, C, S, A | (hérité) |

Une autorisation « Territoire – par contact » existe donc **en plus** de la lecture globale du §1 : c'est voulu (le §1 permet d'afficher le
nom du territoire, le §3 sert de racine pour trouver les établissements). Les droits s'additionnent.

## 4. Pilotage FSJD (lecture de tout)
Quatre autorisations de type **Global**, privilège **L**, rôle `Pilotage FSJD` : `craba_fsjd_site`, `craba_fsjd_batiment`,
`craba_fsjd_documentinventaire`, `craba_fsjd_contrat`.

## 5. Affecter les personnes
- Chaque utilisateur doit avoir un **contact** Dataverse (créé à la première connexion Entra ID, ou à la main) et le rôle web `Responsable technique` (*Contacts → Rôles web*).
- Territorial : dans l'application pilotée par modèle, ouvrir le **Territoire** → sous-grille/relation **Contacts** → ajouter la personne.
- Établissement : ouvrir l'**Établissement** → **Contacts** → ajouter une ou plusieurs personnes.

## 6. Tester
Connectez-vous avec un contact de test relié à **un seul** établissement : la liste ne doit montrer que celui-là, et la création d'un bâtiment
puis le dépôt d'un fichier doivent fonctionner. Puis avec un territorial (tous les établissements du territoire) et enfin avec `Pilotage FSJD`.
Symptômes : liste vide → relation ou rôle manquant ; erreur 403 à la création → privilège **A / AÀ** manquant sur la table concernée ;
liste complète pour tout le monde → une autorisation de type **Global** est restée sur `site`.

## Dépannage : « Aucune relation trouvée » (type d'accès *Accès au contact*)
À essayer dans cet ordre :
1. **Resélectionner la table** : dans le champ *Table*, ouvrez la loupe et **choisissez la ligne dans la liste** (ne pas se contenter de taper le nom).
   Si le bloc « Tables associées » reste vide, la table n'est pas reconnue.
2. **Vérifier la relation** (make.powerapps.com → Tables → `fsjd_site` → *Relations*) : elle doit être de type **Plusieurs-à-plusieurs** et relier
   `fsjd_site` à la table standard **Contact** (nom affiché « Contact », nom logique `contact`), et non à une table personnalisée portant un nom voisin.
3. **Publier** : *Solutions → Publier toutes les personnalisations* (une relation créée mais non publiée n'apparaît pas).
4. **Rafraîchir Power Pages** : *Power Pages → ⋯ (Actions) → Redémarrer le site*, puis recharger le studio (Ctrl+F5) et rouvrir l'autorisation.
5. Vérifier que l'environnement du site Power Pages est bien **le même** que celui où vous avez créé les tables (sélecteur d'environnement en haut à droite).
6. Si rien n'y fait, recréer la relation N:N depuis la table **Contact** (*Relations → Ajouter → Plusieurs-à-plusieurs → table associée `fsjd_site`*), publier, puis recommencer l'étape 3.
