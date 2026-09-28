---
name: publish-blog-post
description: Guide et automatise la publication ou la mise à jour d'articles de blogue sur camosub.ca. Synchronise _posts/, blog/posts/ (FR/EN) et blog.json. À déclencher dès qu'un utilisateur demande d'ajouter, modifier ou rédiger un article de blogue ou un compte-rendu de tournoi.
---

# Compétence : Publication d'Article de Blogue (CAMO Subaquatique)

Cette compétence permet de publier rapidement et sans erreur un nouvel article de blogue sur le site CAMO Subaquatique.

## Procédure pas-à-pas

### Étape 1 : Récupérer les informations nécessaires
Avant de commencer, identifier :
1. **Titre (FR & EN)** : Ex. `Médaille d'or pour CAMO au Seaway Valley Fall Classic 2026` / `Gold Medal for CAMO at the 2026 Seaway Valley Fall Classic`.
2. **Date de publication** : Date de l'événement ou date du jour au format `AAAA-MM-JJ`.
3. **Identifiant URL (slug)** : Ex. `seaway-valley-fall-classic-2026`, `tournoi-guelph-2026`.
4. **Tags** : Liste de mots-clés pertinents (ex. `competition,hockey-sous-marin,camo,tournoi,guelph,argent`).
5. **Images** : Vérifier les images disponibles dans `competitions/<slug>/`.

### Étape 2 : Préparer le contenu Markdown (FR & EN)
Mettre en forme le contenu avec les balises HTML responsive pour les images :

* **Image simple :**
  ```html
  <figure class="my-6">
    <img src="/competitions/.../image.jpg" alt="Description" class="rounded-lg shadow max-w-full h-auto mx-auto">
    <figcaption class="text-sm text-gray-500 text-center mt-2">Légende</figcaption>
  </figure>
  ```
* **Deux images côte à côte (podium, bannière, équipe) :**
  ```html
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
    <figure>
      <img src="/competitions/.../img1.jpg" alt="Photo 1" class="rounded-lg shadow max-w-full h-auto mx-auto">
      <figcaption class="text-sm text-gray-500 text-center mt-2">Légende 1</figcaption>
    </figure>
    <figure>
      <img src="/competitions/.../img2.jpg" alt="Photo 2" class="rounded-lg shadow max-w-full h-auto mx-auto">
      <figcaption class="text-sm text-gray-500 text-center mt-2">Légende 2</figcaption>
    </figure>
  </div>
  ```
* **Écusson / logo rond centré :**
  ```html
  <div class="flex justify-center my-6">
    <figure class="text-center">
      <img src="/competitions/.../logo.png" alt="Logo" class="w-48 md:w-56 h-auto mx-auto rounded-full shadow-lg">
      <figcaption class="text-sm text-gray-500 text-center mt-2">Légende</figcaption>
    </figure>
  </div>
  ```

### Étape 3 : Exécuter le script d'automatisation
Utiliser `scripts/add_post.py` en lui passant le contenu texte :

```bash
python3 scripts/add_post.py \
  --title-fr "Titre de l'article" \
  --title-en "English Title" \
  --date "AAAA-MM-JJ" \
  --slug "mon-slug-2026" \
  --tags "competition,hockey-sous-marin,camo,tournoi" \
  --content-fr "Texte markdown en français..." \
  --content-en "English markdown text..."
```

*(Ou en écrivant les contenus temporaires dans des fichiers et en utilisant `--content-fr-file` et `--content-en-file`)*.

Ce script crée ou met à jour automatiquement :
- `_posts/AAAA-MM-JJ-<slug>.md`
- `blog/posts/<slug>.fr.md`
- `blog/posts/<slug>.en.md`
- `_data/blog.json` et `blog.json` (avec tri chronologique et étiquettes de tags)

### Étape 4 : Vérification
1. Vérifier que `_data/blog.json` et `blog.json` sont strictement identiques (`diff -u _data/blog.json blog.json`).
2. Vérifier que Jekyll compile sans erreur dans `_site/`.
3. Présenter les fichiers générés à l'utilisateur avec des liens markdown cliquables `file://`.
4. Ne pas exécuter d'opérations Git de commit ou push (règle utilisateur).
