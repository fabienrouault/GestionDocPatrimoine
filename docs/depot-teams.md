# Dépôt des documents dans le dossier Teams partagé

**Principe.** Un dossier « Fichiers » d'une équipe Teams est une bibliothèque SharePoint. Power Pages dépose le fichier dans
Dataverse (colonne **Fichier**) ; un **flux Power Automate** le recopie ensuite dans la bibliothèque de l'équipe, au bon endroit,
et renseigne le lien. Avantages : l'utilisateur n'a pas besoin de droits SharePoint, l'arborescence est imposée et uniforme.

## Flux « FSJD – Archiver document vers Teams » (à créer deux fois : documents et contrats)
1. **Déclencheur** : *Dataverse – Quand une ligne est ajoutée, modifiée ou supprimée* · Modifié · table `Documents inventaire`
   (puis `Contrats`) · portée *Organisation* · **colonnes de filtre : `fsjd_fichier`** · filtre de ligne :
   `fsjd_fichier_name ne null`.
2. **Obtenir** les lignes liées : site, bâtiment, modèle (actions *Obtenir une ligne par ID*).
3. **Télécharger un fichier** : *Dataverse – Télécharger un fichier ou une image* (colonne `fsjd_fichier`).
4. **Créer un fichier** (SharePoint) dans le site de l'équipe Teams, bibliothèque `Documents` :
   - Chemin : `/Patrimoine/@{territoire}/@{site}/@{bâtiment ou "Site"}/@{catégorie}`
     (les dossiers manquants sont créés ; remplacer les caractères interdits `" * : < > ? / \ |` par `-`).
   - Nom : `@{libellé}_@{formatDateTime(utcNow(),'yyyyMMdd')}_@{fsjd_fichier_name}` (évite d'écraser une version précédente).
5. **Créer un lien de partage** / *Obtenir le lien* du fichier, puis **Mettre à jour la ligne** Dataverse : `fsjd_lien` = lien.
   Le site affiche alors le nom du fichier comme lien cliquable ; tant que `fsjd_lien` est vide il affiche « transfert vers Teams en cours… ».
6. (Optionnel) Après copie réussie, vider la colonne `fsjd_fichier` pour ne pas doubler le stockage Dataverse.
   *Vérifier d'abord que la conservation du fichier dans Dataverse n'est pas souhaitée.*

Le propriétaire du flux doit être membre de l'équipe Teams (compte de service recommandé). Gérez les erreurs avec une branche
*Configurer l'exécution → en cas d'échec* qui prévient l'équipe Patrimoine.

## Alternative sans flux
L'intégration native **SharePoint de Power Pages** (*Configurer → Intégration SharePoint*) peut attacher une bibliothèque à chaque
enregistrement, mais impose une arborescence par enregistrement et un formulaire de base Power Pages : elle ne s'intègre pas à
l'écran de contrôle actuel. À étudier seulement si la limite de taille de fichier de Dataverse pose problème.
