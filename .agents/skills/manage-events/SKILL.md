---
name: manage-events
description: Guide et automatise l'ajout, la modification, le retrait et l'archivage d'événements sur camosub.ca. Synchronise automatiquement _data/events.json et events.json. À déclencher dès qu'un utilisateur demande d'ajouter, modifier, retirer ou lister des événements ou tournois à venir.
---

# Compétence : Gestion des Événements (CAMO Subaquatique)

Cette compétence permet d'ajouter, mettre à jour, retirer ou archiver rapidement et sans erreur un événement sur le site CAMO Subaquatique via le script `scripts/add_event.py`.

## Fichiers synchronisés
- `_data/events.json` : Utilisé par Jekyll pour la génération de `events.ics` et `events_rss.xml`.
- `events.json` : Fichier JSON chargé dynamiquement par JavaScript sur la page d'accueil (`index.html`).

Ces deux fichiers doivent impérativement rester strictement identiques. Le script s'assure de cette synchronisation.

---

## Commandes courantes

### 1. Ajouter ou mettre à jour un tournoi ou événement

```bash
python3 scripts/add_event.py \
  --id "slug-de-l-evenement" \
  --title-fr "Titre de l'événement en français" \
  --title-en "English Event Title" \
  --start-date "AAAA-MM-JJ" \
  --end-date "AAAA-MM-JJ" \
  --dates-display-fr "21 et 22 novembre 2026" \
  --dates-display-en "November 21–22, 2026" \
  --time-fr "Du samedi 8 h 00 au dimanche 17 h 00" \
  --time-en "Saturday 8:00 AM to Sunday 5:00 PM" \
  --location-name "Complexe sportif Claude-Robillard" \
  --location-address "1000, avenue Émile-Journault" \
  --location-city "Montréal" \
  --location-province "QC" \
  --location-postal-code "H2M 2E7" \
  --organizers-fr "Club CAMO Hockey Sous-Marin & Stéphanie Lagacé" \
  --organizers-en "CAMO Underwater Hockey & Stéphanie Lagacé" \
  --description-fr "Description complète en français..." \
  --description-en "English full description..." \
  --program-title-fr "Ce qui est inclus pour les équipes et athlètes :" \
  --program-title-en "Participant perks:" \
  --program-details-fr "Arbitres de table fournis|Arbitres dans l'eau au moins partiellement fournis|Table de massage|Nourriture offerte" \
  --program-details-en "Deck refs fully provided|Water refs at least partially provided|Massage tables|Food provided" \
  --url "https://www.facebook.com/events/..."
```

### 2. Retirer un événement (ex. tournoi passé)

```bash
python3 scripts/add_event.py --remove "slug-de-l-evenement"
```

### 3. Archiver un événement (garde les données avec `archived: true`)

```bash
python3 scripts/add_event.py --archive "slug-de-l-evenement"
```

### 4. Lister les événements actifs

```bash
python3 scripts/add_event.py --list
```
