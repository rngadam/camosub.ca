#!/usr/bin/env python3
"""
scripts/sync_posts_bilingual.py

Met à jour tous les articles de _posts/ pour supporter le bilinguisme (FR/EN)
avec Kramdown (markdown="1"), et synchronise _data/blog.json et blog.json
avec les URLs des pages standalone (/blog/<slug>.html) et des résumés (excerpts).
"""

import json
import re
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent

data_blog_json = repo_root / "_data" / "blog.json"
root_blog_json = repo_root / "blog.json"

with open(root_blog_json, "r", encoding="utf-8") as f:
    blog_data = json.load(f)

# Excerpts prédéfinis pour les articles existants
excerpts = {
    "rugby-subaquatique-montreal-video": {
        "fr": "Vous vous êtes déjà demandé à quoi ressemble réellement le rugby sous l'eau ? Découvrez un aperçu en vidéo des mouvements, techniques et de l'esprit d'équipe de CAMO à Montréal.",
        "en": "Ever wondered what underwater rugby actually looks like? Watch a video preview of the moves, techniques, and teamwork of CAMO in Montreal."
    },
    "seaway-valley-fall-classic-2026": {
        "fr": "L'équipe CAMO participait à la 15e édition annuelle du Seaway Valley Fall Classic à Cornwall. Après une demi-finale relevée et une prolongation intense en finale, CAMO décroche l'or !",
        "en": "The CAMO team competed at the 15th annual Seaway Valley Fall Classic in Cornwall. Following a tough semi-final and thrilling overtime final, CAMO clinched the gold medal!"
    },
    "conseil-arrondissement-vsp-septembre-2026": {
        "fr": "Intervention du Club CAMO lors de la période de questions citoyennes du conseil d'arrondissement de Villeray–Saint-Michel–Parc-Extension concernant l'avenir et l'entretien des installations aquatiques.",
        "en": "CAMO Club's address during the public question period of the VSP Borough Council regarding the future and maintenance of local aquatic facilities."
    },
    "tournoi-estival-montreal-2026": {
        "fr": "Retour sur l'édition 2026 du tournoi estival de hockey subaquatique de Montréal au bassin du Parc Jean-Drapeau : une journée exceptionnelle de compétition et de camaraderie.",
        "en": "Recap of the 2026 Montreal Underwater Hockey Summer Tournament at the Jean-Drapeau Park pool: an exciting day of competition and sportsmanship."
    },
    "tournoi-guelph-2026": {
        "fr": "Très beau parcours de CAMO au 44e tournoi annuel de Guelph : l'équipe remporte la médaille d'argent au terme de matchs enlevants face à de redoutables adversaires.",
        "en": "Great run for CAMO at the 44th Annual Guelph Tournament: the team brought home the silver medal after exciting matches against top competition."
    },
    "seaway-valley-fall-classic-2025": {
        "fr": "Le CAMO s'illustre en remportant la médaille d'or à la 14e édition du tournoi Seaway Valley Fall Classic à Cornwall.",
        "en": "CAMO shines by capturing the gold medal at the 14th edition of the Seaway Valley Fall Classic in Cornwall."
    },
    "montreal-summer-tournament-2025": {
        "fr": "Demi-finale intense 5-4 contre Sherbrooke et grande finale contre Cornwall au tournoi d'été de hockey subaquatique de Montréal.",
        "en": "Thrilling 5-4 semi-final against Sherbrooke and grand final against Cornwall at the Montreal Underwater Hockey Summer Tournament."
    },
    "tournoi-estival-2025": {
        "fr": "Coup d'envoi du tournoi estival de hockey subaquatique à la piscine du Parc Jean-Drapeau. Horaire et résultats des matchs de classement.",
        "en": "Kickoff of the Montreal Underwater Hockey Summer Tournament at Parc Jean-Drapeau. Schedule and ranking match results."
    },
    "nationaux-hsa-2025": {
        "fr": "Récit complet du Championnat Canadien de Hockey Subaquatique 2025 et parcours remarquable de CAMO vers la médaille d'argent.",
        "en": "Complete recap of the 2025 Canadian Underwater Hockey Championships and CAMO's remarkable run to the silver medal."
    }
}

# Image fallbacks / enrichments for cards
image_enrichments = {
    "rugby-subaquatique-montreal-video": "https://img.youtube.com/vi/WFOVyY9QiHI/hqdefault.jpg",
    "seaway-valley-fall-classic-2026": "/competitions/seaway-classic-2026/received_1064477036404264-COLLAGE.jpg",
    "conseil-arrondissement-vsp-septembre-2026": "https://img.youtube.com/vi/aYvfaArcdis/hqdefault.jpg",
    "tournoi-guelph-2026": "/competitions/guelph-2026/camotarie.png"
}

# 1. Mettre à jour chaque article
for post in blog_data["posts"]:
    slug = post["id"]
    post["url"] = f"/blog/{slug}.html"
    
    if slug in image_enrichments and not post.get("image"):
        post["image"] = image_enrichments[slug]

    fr_info = post.setdefault("fr", {})
    en_info = post.setdefault("en", {})

    if slug in excerpts:
        fr_info["excerpt"] = excerpts[slug]["fr"]
        en_info["excerpt"] = excerpts[slug]["en"]

    title_fr = fr_info.get("title", "")
    title_en = en_info.get("title", title_fr)
    tags = post.get("tags", [])
    image = post.get("image")
    timestamp = post.get("timestamp", "2026-01-01T20:00:00-04:00")
    date_part = timestamp.split("T")[0]
    time_part = timestamp.split("T")[1].split("-")[0].split("+")[0]

    # Obtenir le contenu markdown FR et EN
    content_fr = ""
    content_en = ""
    
    if fr_info.get("content_md"):
        fr_path = repo_root / fr_info["content_md"]
        if fr_path.exists():
            content_fr = fr_path.read_text(encoding="utf-8").strip()
    elif fr_info.get("content"):
        content_fr = fr_info["content"].strip()
        # Créer le fichier md s'il n'existe pas
        md_path = repo_root / "blog" / "posts" / f"{slug}.fr.md"
        md_path.write_text(content_fr + "\n", encoding="utf-8")
        fr_info["content_md"] = f"blog/posts/{slug}.fr.md"

    if en_info.get("content_md"):
        en_path = repo_root / en_info["content_md"]
        if en_path.exists():
            content_en = en_path.read_text(encoding="utf-8").strip()
    elif en_info.get("content"):
        content_en = en_info["content"].strip()
        md_path = repo_root / "blog" / "posts" / f"{slug}.en.md"
        md_path.write_text(content_en + "\n", encoding="utf-8")
        en_info["content_md"] = f"blog/posts/{slug}.en.md"

    if not content_en:
        content_en = content_fr

    # Chercher le fichier _posts existant ou le créer
    posts_dir = repo_root / "_posts"
    existing_files = list(posts_dir.glob(f"*-{slug}.md"))
    if existing_files:
        post_file = existing_files[0]
    else:
        post_file = posts_dir / f"{date_part}-{slug}.md"

    # Construire le contenu Jekyll avec Kramdown markdown="1" pour bilinguisme
    frontmatter = [
        "---",
        "layout: post",
        f'title: "{title_fr}"',
        f'title_fr: "{title_fr}"',
        f'title_en: "{title_en}"',
        f"date: {date_part} {time_part} -0400",
        "lang: fr"
    ]
    if tags:
        frontmatter.append(f"tags: [{', '.join(tags)}]")
    if image:
        frontmatter.append(f"image: {image}")
    frontmatter.append("---")
    frontmatter.append("")
    frontmatter.append('<div class="lang-fr" markdown="1">')
    frontmatter.append("")
    frontmatter.append(content_fr)
    frontmatter.append("")
    frontmatter.append("</div>")
    frontmatter.append("")
    frontmatter.append('<div class="lang-en" markdown="1" style="display:none;">')
    frontmatter.append("")
    frontmatter.append(content_en)
    frontmatter.append("")
    frontmatter.append("</div>")
    frontmatter.append("")

    post_file.write_text("\n".join(frontmatter), encoding="utf-8")
    print(f"Mis à jour: {post_file.name}")

# Sauvegarder blog.json et _data/blog.json
with open(root_blog_json, "w", encoding="utf-8") as f:
    json.dump(blog_data, f, ensure_ascii=False, indent=2)

with open(data_blog_json, "w", encoding="utf-8") as f:
    json.dump(blog_data, f, ensure_ascii=False, indent=2)

print("Synchronisation terminée avec succès !")
