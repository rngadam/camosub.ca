#!/usr/bin/env python3
"""
scripts/add_event.py

Automatise la gestion des événements pour le site CAMO Subaquatique.
Synchronise automatiquement en une seule étape :
1. _data/events.json (utilisé par Jekyll pour events.ics et events_rss.xml)
2. events.json (utilisé par le frontend JS sur index.html)

Fonctionnalités :
- Ajouter ou mettre à jour un événement (--id, --title-fr, etc.)
- Retirer un événement (--remove <id>)
- Archiver un événement (--archive <id>)
- Lister les événements (--list)
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

def slugify(text: str) -> str:
    """Transforme un titre en identifiant slug propre."""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    return re.sub(r'[-\s]+', '-', text)

def load_events(file_path: Path):
    if not file_path.exists():
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Erreur lors de la lecture de {file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def sort_events(events):
    """
    Trie les événements :
    1. Événements récurrents (avec recurrence ou sans startDate) toujours en premier.
    2. Événements ponctuels avec dates particulières en ordre chronologique croissant.
    """
    def sort_key(ev):
        is_recurring = bool(ev.get("recurrence") or not ev.get("startDate"))
        start_date = ev.get("startDate") or ""
        return (0 if is_recurring else 1, start_date, ev.get("id", ""))

    return sorted(events, key=sort_key)

def save_events(events, files, dry_run=False):
    events = sort_events(events)
    content = json.dumps(events, ensure_ascii=False, indent=2) + "\n"
    for file_path in files:
        if dry_run:
            print(f"[dry-run] Écriture dans {file_path}")
        else:
            file_path.write_text(content, encoding="utf-8")
            print(f"✓ Fichier mis à jour : {file_path}")

def main():
    parser = argparse.ArgumentParser(
        description="Gérer les événements sur camosub.ca (_data/events.json & events.json)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )

    # Actions spéciales
    parser.add_argument("--list", action="store_true", help="Lister tous les événements actuels")
    parser.add_argument("--remove", metavar="ID", help="Retirer un événement par son identifiant ID")
    parser.add_argument("--archive", metavar="ID", help="Archiver un événement par son identifiant ID")

    # Données d'ajout / mise à jour
    parser.add_argument("--id", help="Identifiant unique de l'événement (slug auto-généré si omis)")
    parser.add_argument("--title-fr", help="Titre en français")
    parser.add_argument("--title-en", help="Titre en anglais")
    parser.add_argument("--start-date", help="Date de début (AAAA-MM-JJ)")
    parser.add_argument("--end-date", help="Date de fin (AAAA-MM-JJ)")
    parser.add_argument("--dates-display-fr", help="Texte personnalisé pour les dates (FR, ex: '21 et 22 novembre 2026')")
    parser.add_argument("--dates-display-en", help="Texte personnalisé pour les dates (EN, ex: 'November 21–22, 2026')")
    parser.add_argument("--time-fr", help="Horaire en français (ex: 'Du samedi 8h00 au dimanche 17h00')")
    parser.add_argument("--time-en", help="Horaire en anglais (ex: 'Saturday 8:00 AM to Sunday 5:00 PM')")
    parser.add_argument("--time", help="Horaire commun si identique pour FR et EN")
    parser.add_argument("--recurrence-fr", help="Récurrence en français (ex: 'Tous les Mardis')")
    parser.add_argument("--recurrence-en", help="Récurrence en anglais (ex: 'Every Tuesday')")
    parser.add_argument("--rrule", help="Règle iCal RRULE (ex: 'FREQ=WEEKLY;BYDAY=TU')")
    parser.add_argument("--first-event-start-date", help="Date de première occurrence (AAAA-MM-JJ)")

    # Lieu
    parser.add_argument("--location-name", default="Complexe sportif Claude-Robillard", help="Nom du lieu")
    parser.add_argument("--location-address", default="", help="Adresse civique")
    parser.add_argument("--location-city", default="Montréal", help="Ville")
    parser.add_argument("--location-province", default="QC", help="Province")
    parser.add_argument("--location-postal-code", default="", help="Code postal")
    parser.add_argument("--location-country", default="Canada", help="Pays")
    parser.add_argument("--maps-link", default=None, help="Lien Google Maps direct")

    # Organisateurs
    parser.add_argument("--organizers-fr", help="Organisateurs en français")
    parser.add_argument("--organizers-en", help="Organisateurs en anglais")
    parser.add_argument("--organizers", help="Organisateurs communs si identiques")

    # Contenu
    parser.add_argument("--description-fr", help="Description en français")
    parser.add_argument("--description-en", help="Description en anglais")
    parser.add_argument("--program-title-fr", help="Titre du programme / inclus (ex: 'Ce qui est inclus :')")
    parser.add_argument("--program-title-en", help="Titre du programme / perks (ex: 'Participant perks:')")
    parser.add_argument("--program-details-fr", help="Éléments de programme en français (séparés par '|' ou sauts de ligne)")
    parser.add_argument("--program-details-en", help="Éléments de programme en anglais (séparés par '|' ou sauts de ligne)")
    parser.add_argument("--cost-fr", help="Coût en français")
    parser.add_argument("--cost-en", help="Coût en anglais")
    parser.add_argument("--equipment-fr", help="Équipement requis en français")
    parser.add_argument("--equipment-en", help="Équipement requis en anglais")
    parser.add_argument("--notes-fr", help="Notes en français")
    parser.add_argument("--notes-en", help="Notes en anglais")
    parser.add_argument("--url", help="Lien externe (ex: événement Facebook ou billetterie)")
    parser.add_argument("--image", default=None, help="Chemin d'image (ex: /images/... ou null)")
    parser.add_argument("--dry-run", action="store_true", help="Simuler les modifications sans écrire sur le disque")

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    events_json_path = repo_root / "events.json"
    data_events_json_path = repo_root / "_data" / "events.json"
    target_files = [events_json_path, data_events_json_path]

    events = load_events(data_events_json_path if data_events_json_path.exists() else events_json_path)

    # 1. Action : Lister
    if args.list:
        print(f"Événements configurés ({len(events)}) :")
        for i, ev in enumerate(events, 1):
            archived_tag = " [ARCHIVÉ]" if ev.get("archived") else ""
            fr_title = ev.get("fr", {}).get("title", "Sans titre")
            dates = ev.get("startDate", "Pas de date")
            if ev.get("endDate") and ev.get("endDate") != ev.get("startDate"):
                dates += f" -> {ev.get('endDate')}"
            print(f" {i}. [{ev.get('id')}] {fr_title} ({dates}){archived_tag}")
        return

    # 2. Action : Retirer
    if args.remove:
        event_id = args.remove.strip()
        new_events = [ev for ev in events if ev.get("id") != event_id]
        if len(new_events) == len(events):
            print(f"Avertissement: Aucun événement trouvé avec l'id '{event_id}'.", file=sys.stderr)
            sys.exit(1)
        save_events(new_events, target_files, dry_run=args.dry_run)
        print(f"✓ Événement '{event_id}' retiré avec succès.")
        return

    # 3. Action : Archiver
    if args.archive:
        event_id = args.archive.strip()
        found = False
        for ev in events:
            if ev.get("id") == event_id:
                ev["archived"] = True
                found = True
                break
        if not found:
            print(f"Erreur: Aucun événement trouvé avec l'id '{event_id}'.", file=sys.stderr)
            sys.exit(1)
        save_events(events, target_files, dry_run=args.dry_run)
        print(f"✓ Événement '{event_id}' archivé avec succès.")
        return

    # 4. Action : Ajouter / Mettre à jour
    if not args.title_fr:
        parser.error("L'argument --title-fr est obligatoire pour ajouter ou mettre à jour un événement.")

    event_id = args.id.strip() if args.id else slugify(args.title_fr)
    title_fr = args.title_fr.strip()
    title_en = args.title_en.strip() if args.title_en else title_fr

    # Construction du champ time
    time_val = None
    if args.time_fr or args.time_en:
        time_val = {
            "fr": args.time_fr.strip() if args.time_fr else (args.time or ""),
            "en": args.time_en.strip() if args.time_en else (args.time or "")
        }
    elif args.time:
        time_val = args.time.strip()

    # Recurrence
    recurrence_val = None
    if args.recurrence_fr or args.recurrence_en:
        recurrence_val = {
            "fr": args.recurrence_fr.strip() if args.recurrence_fr else "",
            "en": args.recurrence_en.strip() if args.recurrence_en else ""
        }

    # Location
    location = {
        "name": args.location_name.strip(),
        "address": args.location_address.strip(),
        "city": args.location_city.strip(),
        "province": args.location_province.strip(),
        "postalCode": args.location_postal_code.strip(),
        "country": args.location_country.strip(),
    }
    if args.maps_link:
        location["mapsLink"] = args.maps_link.strip()
    elif args.location_address or args.location_name:
        query_parts = [location["name"], location["address"], location["city"], location["province"], location["postalCode"]]
        query_str = ", ".join(p for p in query_parts if p)
        location["mapsLink"] = f"https://www.google.com/maps/search/?api=1&query={query_str.replace(' ', '+')}"

    # Program details helper
    def parse_program_details(raw):
        if not raw:
            return None
        if "|" in raw:
            items = [item.strip() for item in raw.split("|") if item.strip()]
        else:
            items = [item.strip() for item in raw.split("\n") if item.strip()]
        return items if items else None

    program_details_fr = parse_program_details(args.program_details_fr)
    program_details_en = parse_program_details(args.program_details_en)

    organizers_fr = args.organizers_fr.strip() if args.organizers_fr else (args.organizers.strip() if args.organizers else None)
    organizers_en = args.organizers_en.strip() if args.organizers_en else (args.organizers.strip() if args.organizers else None)

    fr_data = {
        "title": title_fr,
        "description": args.description_fr.strip() if args.description_fr else "",
        "details": None,
    }
    if args.dates_display_fr:
        fr_data["dateDisplay"] = args.dates_display_fr.strip()
    if args.time_fr:
        fr_data["time"] = args.time_fr.strip()
    if organizers_fr:
        fr_data["organizers"] = organizers_fr
    if args.cost_fr:
        fr_data["cost"] = args.cost_fr.strip()
    if args.equipment_fr:
        fr_data["equipmentNeeded"] = args.equipment_fr.strip()
    if args.program_title_fr:
        fr_data["programTitle"] = args.program_title_fr.strip()
    if program_details_fr:
        fr_data["programDetails"] = program_details_fr
    if args.notes_fr:
        fr_data["notes"] = args.notes_fr.strip()
    if args.url:
        fr_data["url"] = args.url.strip()

    en_data = {
        "title": title_en,
        "description": args.description_en.strip() if args.description_en else (args.description_fr.strip() if args.description_fr else ""),
        "details": None,
    }
    if args.dates_display_en:
        en_data["dateDisplay"] = args.dates_display_en.strip()
    elif args.dates_display_fr:
        en_data["dateDisplay"] = args.dates_display_fr.strip()
    if args.time_en:
        en_data["time"] = args.time_en.strip()
    if organizers_en:
        en_data["organizers"] = organizers_en
    if args.cost_en:
        en_data["cost"] = args.cost_en.strip()
    if args.equipment_en:
        en_data["equipmentNeeded"] = args.equipment_en.strip()
    if args.program_title_en:
        en_data["programTitle"] = args.program_title_en.strip()
    if program_details_en:
        en_data["programDetails"] = program_details_en
    if args.notes_en:
        en_data["notes"] = args.notes_en.strip()
    if args.url:
        en_data["url"] = args.url.strip()

    new_event = {
        "id": event_id,
        "startDate": args.start_date.strip() if args.start_date else None,
        "endDate": args.end_date.strip() if args.end_date else None,
        "time": time_val,
        "recurrence": recurrence_val,
        "firstEventStartDate": args.first_event_start_date.strip() if args.first_event_start_date else None,
        "location": location,
        "fr": fr_data,
        "en": en_data,
        "image": args.image.strip() if args.image else None,
    }
    if args.rrule:
        new_event["rrule"] = args.rrule.strip()

    # Mise à jour ou ajout
    existing_index = next((i for i, ev in enumerate(events) if ev.get("id") == event_id), None)
    if existing_index is not None:
        events[existing_index] = new_event
        action_verb = "mis à jour"
    else:
        events.append(new_event)
        action_verb = "ajouté"

    save_events(events, target_files, dry_run=args.dry_run)
    print(f"✓ Événement '{event_id}' {action_verb} avec succès dans _data/events.json et events.json.")

if __name__ == "__main__":
    main()
