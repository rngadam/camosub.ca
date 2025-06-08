import json
from datetime import datetime, date, time, timedelta
from ics import Calendar, Event
# Reverted ContentLine import attempt
import os
import re # For parsing time more flexibly
import pytz

# --- Timezone Definition ---
TARGET_TZ = pytz.timezone("America/Montreal")

# --- Helper Functions ---

def parse_time_str(time_str, lang='fr'):
    """
    Parses a time string like "19h30 - 20h30" or "7:30 PM - 8:30 PM".
    Returns (start_time, end_time) or (start_time, None) if only start is present.
    Times are returned as datetime.time objects.
    Handles 'h' separator for French times and AM/PM for English.
    """
    if not time_str:
        return None, None

    # Normalize AM/PM to 24-hour format for easier parsing if present
    time_str = time_str.upper().replace(" ", "") # Remove spaces

    # Regex to capture start and optional end time, supporting different formats
    # Supports HH:MM, HHhMM, HH:MMAM/PM, HHhMMAM/PM
    # And ranges like HH:MM-HH:MM or HH:MMAM/PM-HH:MMAM/PM
    pattern = re.compile(
        r"(\d{1,2})[H:](\d{2})(AM|PM)?"  # Start time: HH:MM or HHhMM, optional AM/PM
        r"(?:-(\d{1,2})[H:](\d{2})(AM|PM)?)?"  # Optional end time
    )
    match = pattern.match(time_str)

    if not match:
        print(f"Warning: Could not parse time string: {time_str}")
        return None, None

    g = match.groups()

    start_hour, start_minute, start_ampm, end_hour, end_minute, end_ampm = g

    def convert_to_time(hour_str, minute_str, ampm_str):
        if not hour_str or not minute_str:
            return None
        hour = int(hour_str)
        minute = int(minute_str)
        if ampm_str: # AM/PM is present
            if ampm_str == "PM" and hour < 12:
                hour += 12
            elif ampm_str == "AM" and hour == 12: # Midnight case
                hour = 0
        return time(hour, minute)

    parsed_start_time = convert_to_time(start_hour, start_minute, start_ampm)
    parsed_end_time = convert_to_time(end_hour, end_minute, end_ampm)

    return parsed_start_time, parsed_end_time

# Removed get_next_weekday as it's no longer needed for new recurrence logic

# --- Main Script Logic ---

def generate_ics():
    events_json_path = 'events.json'
    # Output path changed to root directory
    ics_output_path = 'events.ics'

    if not os.path.exists(events_json_path):
        print(f"Error: {events_json_path} not found.")
        return

    try:
        with open(events_json_path, 'r', encoding='utf-8') as f:
            events_data = json.load(f)
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {events_json_path}.")
        return
    except Exception as e:
        print(f"Error reading {events_json_path}: {e}")
        return

    cal = Calendar()
    # X-Properties addition removed due to errors.

    for ev_json in events_data:
        e = Event()
        event_id = ev_json.get('id', '')
        e.uid = f"{event_id}@{ev_json.get('domain', 'camosub.ca')}" # Allow domain override if needed

        fr_data = ev_json.get('fr', {})
        en_data = ev_json.get('en', {})

        e.name = fr_data.get('title') or en_data.get('title') or 'Untitled Event'

        description_parts = []
        main_description_fr = fr_data.get('description')
        main_description_en = en_data.get('description')
        details_fr = fr_data.get('details')
        details_en = en_data.get('details')

        if main_description_fr:
            description_parts.append(main_description_fr)
        elif main_description_en:
            description_parts.append(main_description_en)

        if details_fr:
            description_parts.append("\n\nDétails (FR):\n" + details_fr)
        elif details_en: # Only add EN details if FR details weren't primary
            description_parts.append("\n\nDetails (EN):\n" + details_en)

        e.description = "\n".join(description_parts).strip()


        loc = ev_json.get('location', {})
        if loc:
            loc_parts = [loc.get('name'), loc.get('address'), loc.get('city'), loc.get('province'), loc.get('postalCode'), loc.get('country')]
            e.location = ", ".join(filter(None, loc_parts))

        e.url = fr_data.get('url') or en_data.get('url')

        start_date_str = ev_json.get('startDate')
        end_date_str = ev_json.get('endDate')
        time_str = ev_json.get('time') # This can be for FR or EN, assuming format is parsable

        # Determine language for time parsing (prefer FR if available, fallback to EN for AM/PM)
        # This is a simplification; ideally, time format should be language-agnostic in JSON or explicitly stated.
        time_parse_lang = 'fr'
        if fr_data.get('title'): # Check if French content exists
             # Heuristic: if time string contains AM/PM, it's likely English format
            if time_str and ("AM" in time_str.upper() or "PM" in time_str.upper()):
                time_parse_lang = 'en'
        elif en_data.get('title') and time_str and ("AM" in time_str.upper() or "PM" in time_str.upper()):
            time_parse_lang = 'en'


        parsed_start_time, parsed_end_time = parse_time_str(time_str, lang=time_parse_lang)

        rrule = ev_json.get('rrule')
        first_event_start_date_str = ev_json.get('firstEventStartDate')

        if rrule and first_event_start_date_str:
            # New recurring event logic
            if parsed_start_time:
                try:
                    first_event_date = datetime.strptime(first_event_start_date_str, '%Y-%m-%d').date()
                    naive_dt_start = datetime.combine(first_event_date, parsed_start_time)
                    e.begin = TARGET_TZ.localize(naive_dt_start)
                    e.rrule = rrule

                    if parsed_end_time:
                        # Calculate duration
                        # Create full datetime for end to handle potential overnight
                        naive_dt_end_on_start_date = datetime.combine(first_event_date, parsed_end_time)
                        if naive_dt_end_on_start_date <= naive_dt_start: # End time is on the next day or duration is 24h
                            naive_dt_end_on_start_date += timedelta(days=1)
                        e.duration = naive_dt_end_on_start_date - naive_dt_start
                    else:
                        e.duration = timedelta(hours=1) # Default duration for recurring if no end time
                except ValueError:
                    print(f"Warning: Could not parse firstEventStartDate for recurring event '{e.name}'. Skipping.")
                    continue
            else:
                print(f"Warning: Recurring event '{e.name}' has no valid time specified. Skipping.")
                continue

        elif start_date_str:
            # Standard event with a start date
            try:
                event_start_date_obj = datetime.strptime(start_date_str, '%Y-%m-%d').date()

                if parsed_start_time:
                    naive_dt_start = datetime.combine(event_start_date_obj, parsed_start_time)
                    e.begin = TARGET_TZ.localize(naive_dt_start)

                    if parsed_end_time:
                        event_end_date_obj = event_start_date_obj # Assume same day unless endDate is different
                        if end_date_str and end_date_str != start_date_str:
                             event_end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d').date()

                        naive_dt_end = datetime.combine(event_end_date_obj, parsed_end_time)
                        if naive_dt_end <= naive_dt_start and event_end_date_obj == event_start_date_obj : # Handle overnight for single day event
                            naive_dt_end += timedelta(days=1)
                        e.end = TARGET_TZ.localize(naive_dt_end)

                    elif end_date_str and end_date_str != start_date_str:
                         # Multi-day event, but no specific end time. Assume ends at same time as start.
                         event_end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                         naive_dt_end = datetime.combine(event_end_date_obj, parsed_start_time)
                         e.end = TARGET_TZ.localize(naive_dt_end)
                    else: # Single day event, no specific end time, use duration
                        e.duration = timedelta(hours=2)
                else:
                    # All-day event
                    e.begin = event_start_date_obj # This should be a date object
                    e.make_all_day()
                    if end_date_str and end_date_str != start_date_str:
                        event_end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        # For multi-day all-day events, DTEND is the start of the day *after* the last day.
                        e.end = event_end_date_obj + timedelta(days=1)
                    # If single all-day event, ics.py handles DTEND correctly if not set (or set to begin_date + 1 day)
            except ValueError:
                print(f"Warning: Could not parse date for event '{e.name}'. Skipping.")
                continue
        else:
            # Fallback for old recurring events if any, or events missing crucial date info
            if ev_json.get('recurrence') and parsed_start_time : # Old recurrence field
                 print(f"Warning: Event '{e.name}' uses old recurrence format. Please update to rrule and firstEventStartDate. Skipping.")
            else:
                 print(f"Warning: Event '{e.name}' has no startDate or new recurrence fields. Skipping.")
            continue

        cal.events.add(e)

    # Removed directory creation logic as output is in root

    try:
        with open(ics_output_path, 'w', encoding='utf-8') as f:
            f.write(cal.serialize())
        print(f"Successfully generated {ics_output_path}")
    except Exception as e:
        print(f"Error writing ICS file {ics_output_path}: {e}")

if __name__ == '__main__':
    generate_ics()
    # Test the time parser
    # print(parse_time_str("19h30 - 20h30", 'fr')) # Test cases
    # print(parse_time_str("7:30PM - 8:30PM", 'en'))
    # print(parse_time_str("19:30", 'fr'))
    # print(parse_time_str("10:00 AM", 'en')) # Test cases
    # print(parse_time_str(None))
    # print(parse_time_str("Invalid Time String"))
