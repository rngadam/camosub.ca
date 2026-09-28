# Club CAMO Subaquatique (camosub.ca)

Site officiel du **Club CAMO Subaquatique** (Hockey subaquatique et Rugby subaquatique à Montréal).

* Site en ligne : [https://camosub.ca](https://camosub.ca)

---

## 🛠️ Architecture du projet

Le site est propulsé par **Jekyll** et conçu pour être compilé et déployé nativement par **GitHub Pages**.

### Structure des répertoires et fichiers clés :
* `_config.yml` : Configuration globale de Jekyll (100 % natif, zéro dépendance de gem externe).
* `_data/` :
  * `events.json` : Données des entraînements et événements à venir.
  * `blog.json` : Métadonnées et contenus des articles du blog.
* `_layouts/` : Modèles de pages (`default.html`, `page.html`, `post.html`).
* `_includes/` : Composants réutilisables (`header.html`, `footer.html`, `bubbles.html`, `lang_switch.html`).
* `_posts/` : Articles de blog au format Markdown (`YYYY-MM-DD-titre.md`).
* `index.html` : Page d'accueil bilingue (inscriptions, présentation des disciplines, exercices, coordonnées).
* `events.ics` : Modèle Liquid générant automatiquement le calendrier iCalendar lors du build Jekyll.
* `events_rss.xml` & `blog_rss.xml` : Modèles Liquid générant nativement les flux RSS 2.0.
* `.github/workflows/static.yml` : Workflow GitHub Actions pour la compilation Jekyll et le déploiement sur GitHub Pages.

---

## 💻 Tester et prévisualiser localement

### Avec Nix (Recommandé)

Lancez le serveur Jekyll avec rechargement automatique à chaud (*live-reload*) :

```bash
# Commande moderne Nix Flakes / nix CLI
nix shell nixpkgs#jekyll -c jekyll serve

# Ou avec nix-shell classique
nix-shell -p jekyll --run "jekyll serve"
```

Si vous souhaitez utiliser l'environnement Bundler complet :
```bash
nix-shell -p ruby bundler --run "bundle install && bundle exec jekyll serve"
```

Ouvrez ensuite votre navigateur sur **`http://localhost:4000`**.

### Avec Ruby / Bundler standard (sans Nix)

```bash
bundle install
bundle exec jekyll serve
```

---

## 📝 Guide de maintenance

### 1. Mettre à jour les informations d'inscription et de saison
* Ouvrir [`index.html`](index.html).
* Modifier la section d'inscription dans la partie française (`class="lang-fr"`) et anglaise (`class="lang-en"`).
* Mettre à jour les tarifs, dates limites, liens de paiement (ex. Zeffy) et la liste des membres du Conseil d'Administration.
* Mettre à jour la liste des administrateurs dans [`mission.html`](mission.html).

### 2. Ajouter ou modifier un événement
* Éditer le fichier [`_data/events.json`](_data/events.json) (et [`events.json`](events.json)).
* Les flux [`events.ics`](events.ics) et [`events_rss.xml`](events_rss.xml) seront automatiquement régénérés lors du build Jekyll.

### 3. Publier un nouvel article de blog

**Méthode recommandée (automatisée) :**
Utiliser le script [`scripts/add_post.py`](scripts/add_post.py) qui crée et synchronise automatiquement tous les fichiers (`_posts/`, `blog/posts/` FR/EN, et `blog.json`) :
```bash
python3 scripts/add_post.py --title-fr "Mon Titre" --title-en "My Title" --date "AAAA-MM-JJ" --tags "competition,camo" --content-fr "Contenu..."
```

**Méthode manuelle :**
* Créer un fichier dans `_posts/` nommé selon la convention :  
  `_posts/AAAA-MM-JJ-mon-titre.md`
  ```markdown
  ---
  layout: post
  title: "Titre de l'article"
  date: AAAA-MM-JJ HH:MM:SS -0400
  lang: fr
  image: url-ou-chemin-image
  ---
  Contenu en Markdown ici...
  ```
* Créer les versions Markdown dans `blog/posts/<slug>.fr.md` et `blog/posts/<slug>.en.md`.
* Ajouter également l'entrée correspondante dans [`_data/blog.json`](_data/blog.json) et [`blog.json`](blog.json) pour assurer le filtrage dynamique sur [`blog.html`](blog.html).

---

## 🚀 Déploiement

Le déploiement est entièrement automatisé :
1. Chaque push ou fusion sur la branche `main` déclenche le workflow GitHub Actions [`.github/workflows/static.yml`](.github/workflows/static.yml).
2. L'action officielle `actions/jekyll-build-pages` compile le site avec l'ensemble des gems et plugins GitHub Pages.
3. Le site statique compilé (`_site/`) est publié sur GitHub Pages.
