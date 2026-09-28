#!/usr/bin/env python3
"""
scripts/add_post.py

Automatise la publication d'un article de blogue pour le site CAMO Subaquatique.
Génère et synchronise en une seule étape :
1. _posts/AAAA-MM-JJ-<slug>.md (Jekyll pour les pages individuelles et le build statique)
2. blog/posts/<slug>.fr.md (Contenu FR pour le rendu dynamique dans blog.html)
3. blog/posts/<slug>.en.md (Contenu EN pour le rendu dynamique dans blog.html)
4. _data/blog.json et blog.json (Métadonnées triées chronologiquement + tags)
"""

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

def slugify(text: str) -> str:
    """Transforme un titre en slug d'URL propre."""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    return re.sub(r'[-\s]+', '-', text)

def main():
    parser = argparse.ArgumentParser(
        description="Publier un nouvel article de blogue sur camosub.ca",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("--title-fr", required=True, help="Titre de l'article en français")
    parser.add_argument("--title-en", default=None, help="Titre de l'article en anglais (optionnel)")
    parser.add_argument("--date", default=None, help="Date de l'article (AAAA-MM-JJ ou AAAA-MM-JJ HH:MM:SS), défaut: aujourd'hui")
    parser.add_argument("--slug", default=None, help="Identifiant slug de l'article (auto-généré si omis)")
    parser.add_argument("--tags", default="competition,hockey-sous-marin,camo,tournoi", help="Liste de tags séparés par des virgules")
    parser.add_argument("--categories", default="competition,hockey-sous-marin", help="Liste de catégories séparées par des virgules")
    parser.add_argument("--image", default=None, help="Chemin de l'image principale (ex: /competitions/guelph-2026/camotarie.png) ou omis")
    parser.add_argument("--content-fr", default=None, help="Contenu texte Markdown en français")
    parser.add_argument("--content-fr-file", default=None, help="Fichier contenant le Markdown en français")
    parser.add_argument("--content-en", default=None, help="Contenu texte Markdown en anglais")
    parser.add_argument("--content-en-file", default=None, help="Fichier contenant le Markdown en anglais")
    parser.add_argument("--excerpt-fr", default=None, help="Résumé court de l'article en français")
    parser.add_argument("--excerpt-en", default=None, help="Résumé court de l'article en anglais")
    parser.add_argument("--dry-run", action="store_true", help="Afficher les actions sans écrire les fichiers")

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent

    # 1. Date
    if args.date:
        raw_date = args.date.strip()
        if len(raw_date) == 10:  # AAAA-MM-JJ
            date_str = raw_date
            time_str = "20:00:00"
        elif " " in raw_date:
            date_str, time_str = raw_date.split(" ", 1)
        elif "T" in raw_date:
            date_str, time_str = raw_date.split("T", 1)
            time_str = time_str.split("-")[0].split("+")[0]
        else:
            date_str = raw_date
            time_str = "20:00:00"
    else:
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")

    jekyll_date = f"{date_str} {time_str} -0400"
    iso_timestamp = f"{date_str}T{time_str}-04:00"

    # 2. Slug
    slug = args.slug.strip() if args.slug else slugify(args.title_fr)
    if not slug:
        print("Erreur: Impossible de générer un slug valide.", file=sys.stderr)
        sys.exit(1)

    # 3. Titles
    title_fr = args.title_fr.strip()
    title_en = args.title_en.strip() if args.title_en else title_fr

    # 4. Tags & Categories
    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    categories = [c.strip() for c in args.categories.split(",") if c.strip()]

    # 5. Content
    content_fr = ""
    if args.content_fr_file:
        content_fr = Path(args.content_fr_file).read_text(encoding="utf-8").strip()
    elif args.content_fr:
        content_fr = args.content_fr.strip()
    else:
        content_fr = f"Contenu de l'article à venir pour {title_fr}."

    content_en = ""
    if args.content_en_file:
        content_en = Path(args.content_en_file).read_text(encoding="utf-8").strip()
    elif args.content_en:
        content_en = args.content_en.strip()
    else:
        content_en = content_fr

    # Helper for clean excerpt
    def make_excerpt(md_text: str, default_text: str) -> str:
        clean = re.sub(r'<[^>]+>', ' ', md_text)
        clean = re.sub(r'!\[.*?\]\(.*?\)', '', clean)
        clean = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', clean)
        clean = re.sub(r'#+\s+.*', '', clean)
        clean = re.sub(r'[*_`]', '', clean)
        clean = ' '.join(clean.split())
        if len(clean) > 220:
            return clean[:217] + '...'
        return clean or default_text

    excerpt_fr = args.excerpt_fr.strip() if args.excerpt_fr else make_excerpt(content_fr, title_fr)
    excerpt_en = args.excerpt_en.strip() if args.excerpt_en else make_excerpt(content_en, title_en)

    # 6. Target file paths
    post_filename = f"{date_str}-{slug}.md"
    jekyll_post_path = repo_root / "_posts" / post_filename
    blog_fr_path = repo_root / "blog" / "posts" / f"{slug}.fr.md"
    blog_en_path = repo_root / "blog" / "posts" / f"{slug}.en.md"
    data_blog_json_path = repo_root / "_data" / "blog.json"
    root_blog_json_path = repo_root / "blog.json"

    # Jekyll frontmatter with bilingual support
    jekyll_lines = [
        "---",
        "layout: post",
        f'title: "{title_fr}"',
        f'title_fr: "{title_fr}"',
        f'title_en: "{title_en}"',
        f"date: {jekyll_date}",
        "lang: fr"
    ]
    if tags:
        jekyll_lines.append(f"tags: [{', '.join(tags)}]")
    if args.image:
        jekyll_lines.append(f"image: {args.image}")
    jekyll_lines.append("---")
    jekyll_lines.append("")
    jekyll_lines.append('<div class="lang-fr" markdown="1">')
    jekyll_lines.append("")
    jekyll_lines.append(content_fr)
    jekyll_lines.append("")
    jekyll_lines.append("</div>")
    jekyll_lines.append("")
    jekyll_lines.append('<div class="lang-en" markdown="1" style="display:none;">')
    jekyll_lines.append("")
    jekyll_lines.append(content_en)
    jekyll_lines.append("")
    jekyll_lines.append("</div>")
    jekyll_lines.append("")
    jekyll_content = "\n".join(jekyll_lines)

    # Blog post entry for blog.json
    new_post_entry = {
        "id": slug,
        "url": f"/blog/{slug}.html",
        "timestamp": iso_timestamp,
        "image": args.image,
        "tags": tags,
        "fr": {
            "title": title_fr,
            "excerpt": excerpt_fr,
            "content_md": f"blog/posts/{slug}.fr.md"
        },
        "en": {
            "title": title_en,
            "excerpt": excerpt_en,
            "content_md": f"blog/posts/{slug}.en.md"
        }
    }

    print(f"=== Publication de l'article : {title_fr} ===")
    print(f"  * Slug: {slug}")
    print(f"  * Date: {jekyll_date}")
    print(f"  * Tags: {tags}")
    print(f"  * Image: {args.image or 'Aucune'}")
    print(f"  * Fichier Jekyll: {jekyll_post_path.relative_to(repo_root)}")
    print(f"  * Fichier FR: {blog_fr_path.relative_to(repo_root)}")
    print(f"  * Fichier EN: {blog_en_path.relative_to(repo_root)}")

    if args.dry_run:
        print("[DRY-RUN] Aucun fichier n'a été modifié.")
        return

    # Create directories if needed
    jekyll_post_path.parent.mkdir(parents=True, exist_ok=True)
    blog_fr_path.parent.mkdir(parents=True, exist_ok=True)

    # Write Markdown files
    jekyll_post_path.write_text(jekyll_content, encoding="utf-8")
    blog_fr_path.write_text(content_fr + "\n", encoding="utf-8")
    blog_en_path.write_text(content_en + "\n", encoding="utf-8")

    # Update blog.json & _data/blog.json
    for json_path in [data_blog_json_path, root_blog_json_path]:
        if not json_path.exists():
            continue
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Erreur de lecture de {json_path}: {e}", file=sys.stderr)
            continue

        posts = data.get("posts", [])
        # Replace existing post if slug matches, otherwise append
        existing_idx = next((i for i, p in enumerate(posts) if p.get("id") == slug), None)
        if existing_idx is not None:
            posts[existing_idx] = new_post_entry
            print(f"  * Remplacement de l'entrée existante dans {json_path.name}")
        else:
            posts.append(new_post_entry)
            print(f"  * Ajout de l'entrée dans {json_path.name}")

        # Sort posts by timestamp descending
        posts.sort(key=lambda p: p.get("timestamp", ""), reverse=True)
        data["posts"] = posts

        # Ensure all tags exist in tag_labels config
        config = data.setdefault("config", {})
        tag_labels = config.setdefault("tag_labels", {})
        for t in tags:
            if t not in tag_labels:
                formatted_label = t.replace("-", " ").title()
                tag_labels[t] = {
                    "en": formatted_label,
                    "fr": formatted_label
                }
                print(f"  * Ajout de l'étiquette de tag '{t}' dans {json_path.name}")

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    print(" Succès ! Tous les fichiers ont été générés et synchronisés.")

if __name__ == "__main__":
    main()
