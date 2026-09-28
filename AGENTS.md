# Guide de Développement et Instructions pour les Agents IA

Ce document décrit l'architecture du projet **camosub.ca** et fournit des directives précises pour les agents IA afin d'éviter toute redondance d'analyse ou de planification lors des tâches récurrentes.

---

## 1. Architecture Générale du Site

* **Moteur :** Jekyll (Ruby / Kramdown / GitHub Pages compatible).
* **Styling :** Tailwind CSS via CDN avec plugin typography (`@tailwindcss/typography`) et CSS personnalisé dans `assets/css/`.
* **Bilinguisme (FR / EN) :** 
  * Sélecteur de langue dans l'en-tête de navigation.
  * Pages hybrides avec bascule dynamique JavaScript (`lang-fr` / `lang-en`) et stockage du choix dans `localStorage`.

---

## 2. Système de Blogue et Publication d'Articles

Pour chaque article de blogue, **4 emplacements de fichiers** doivent être maintenus de manière synchronisée :

1. **`_posts/AAAA-MM-JJ-<slug>.md`** :  
   Fichier Jekyll standard utilisé pour la génération statique de la page individuelle de l'article (`_layouts/post.html`).
2. **`blog/posts/<slug>.fr.md`** :  
   Contenu Markdown brut en français, chargé dynamiquement par JavaScript dans [`blog.html`](blog.html) via `fetch()`.
3. **`blog/posts/<slug>.en.md`** :  
   Contenu Markdown brut en anglais (traduction pour les visiteurs anglophones).
4. **`_data/blog.json` et `blog.json`** :  
   Index central des articles avec horodatage ISO, tags, chemins Markdown et étiquettes de traduction de tags (`config.tag_labels`). Ces deux fichiers **doivent toujours rester rigoureusement identiques**.

### ⚡ Automatisation : Script `scripts/add_post.py`

**IMPORTANT :** Utilisez toujours le script automatisé pour créer ou mettre à jour un article de blogue. Il génère tous les fichiers ci-dessus et maintient le tri chronologique ainsi que la configuration des tags en une seule commande.

```bash
python3 scripts/add_post.py \
  --title-fr "Titre de l'article en français" \
  --title-en "English Article Title" \
  --date "AAAA-MM-JJ" \
  --slug "mon-slug" \
  --tags "competition,hockey-sous-marin,camo,tournoi,mon-tag" \
  --content-fr-file "chemin/vers/texte_fr.md" \
  --content-en-file "chemin/vers/texte_en.md"
```

Pour voir toutes les options :
```bash
python3 scripts/add_post.py --help
```

---

## 3. Gestion des Événements et Tournois

Les données d'événements sont stockées dans deux fichiers qui **doivent toujours rester strictement identiques** :
1. **`_data/events.json`** : Utilisé par Jekyll pour compiler les flux statiques [`events.ics`](events.ics) et [`events_rss.xml`](events_rss.xml).
2. **`events.json`** : Chargé dynamiquement par JavaScript dans la page d'accueil ([`index.html`](index.html)).

### ⚡ Automatisation : Script `scripts/add_event.py`

**IMPORTANT :** Utilisez toujours le script automatisé pour ajouter, modifier, archiver ou retirer un événement :

```bash
# Ajouter ou mettre à jour un événement
python3 scripts/add_event.py \
  --id "mon-evenement" \
  --title-fr "Titre FR" \
  --title-en "Titre EN" \
  --start-date "AAAA-MM-JJ" \
  --end-date "AAAA-MM-JJ" \
  --location-name "Lieu" \
  --description-fr "Description FR" \
  --description-en "Description EN" \
  --url "https://..."

# Retirer un événement passé
python3 scripts/add_event.py --remove "mon-evenement"

# Lister les événements
python3 scripts/add_event.py --list
```

Consultez `.agents/skills/manage-events/SKILL.md` pour toutes les options.

---

## 4. Gestion des Médias et Images de Compétition

* Les photos et visuels de tournois sont stockés dans `competitions/<nom-tournoi-annee>/`.
* Pour un affichage soigné et responsive dans Tailwind / Prose, utilisez les balises HTML suivantes :

### Image simple avec légende centrée :
```html
<figure class="my-6">
  <img src="/competitions/.../image.jpg" alt="Description" class="rounded-lg shadow max-w-full h-auto mx-auto">
  <figcaption class="text-sm text-gray-500 text-center mt-2">Légende explicative.</figcaption>
</figure>
```

### Grille 2 colonnes (bannières, trophées, podiums) :
```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
  <figure>
    <img src="/competitions/.../photo1.jpg" alt="Photo 1" class="rounded-lg shadow max-w-full h-auto mx-auto">
    <figcaption class="text-sm text-gray-500 text-center mt-2">Légende 1.</figcaption>
  </figure>
  <figure>
    <img src="/competitions/.../photo2.jpg" alt="Photo 2" class="rounded-lg shadow max-w-full h-auto mx-auto">
    <figcaption class="text-sm text-gray-500 text-center mt-2">Légende 2.</figcaption>
  </figure>
</div>
```

### Écusson ou logo d'équipe centré :
```html
<div class="flex justify-center my-6">
  <figure class="text-center">
    <img src="/competitions/.../logo.png" alt="Logo" class="w-48 md:w-56 h-auto mx-auto rounded-full shadow-lg">
    <figcaption class="text-sm text-gray-500 text-center mt-2">L'emblème officiel.</figcaption>
  </figure>
</div>
```

---

## 5. Règles et Contraintes de Travail

1. **Règles Git :**
   * **NE PAS** committer (`git commit`), **NE PAS** pousser vers le dépôt distant (`git push`), et **NE PAS** indexer (`git add`) sans instruction expresse de l'utilisateur. Laisser l'utilisateur gérer l'indexation et les opérations distantes.
2. **Serveur de développement :**
   * Un serveur Jekyll tourne généralement en tâche de fond (`nix run nixpkgs#jekyll -- serve` sur le port 4000). Les modifications de fichiers déclenchent automatiquement la recompilation dans `_site/`.
3. **Compétences dédiées :**
   * Consultez `.agents/skills/publish-blog-post/SKILL.md` pour le pas-à-pas de publication de blogue.
   * Consultez `.agents/skills/manage-events/SKILL.md` pour la gestion des événements et tournois.
4. **Environnement d'exécution Python & Outils d'image :**
   * Un environnement virtuel local `.venv/` est configuré à la racine avec `pillow` (`requirements.txt`).
   * Pour exécuter des scripts Python nécessitant des dépendances, utilisez toujours `.venv/bin/python3`.
   * Pour le traitement d'images sans dépendre du démon Nix, ImageMagick est disponible localement via `/opt/homebrew/bin/magick`.
   * Si une commande Nix doit être exécutée (`nix run`), elle nécessite `BypassSandbox: true` pour accéder au socket du démon Nix `/nix/var/nix/daemon-socket/socket`.
