import json
from datetime import datetime, date, time, timedelta
from ics import Calendar, Event
import os
import re # For parsing time more flexibly

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


def get_next_weekday(start_date, weekday):
    """
    Calculates the next occurrence of a specific weekday (0=Mon, 1=Tue, ..., 6=Sun)
    on or after start_date.
    """
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:  # Target day already passed this week
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)

# --- Main Script Logic ---

def generate_ics():
    events_json_path = 'events.json'
    ics_output_dir = 'assets'
    ics_output_path = os.path.join(ics_output_dir, 'events.ics')

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

        if ev_json.get('recurrence'):
            # Recurring event (e.g., Newbie Training)
            if parsed_start_time:
                # Determine the first DTSTART
                # For "Every Tuesday", BYDAY=TU. For "Tous les Mardis", also BYDAY=TU
                # This assumes recurrence is weekly. More complex recurrences would need more data in JSON.
                # For "Tous les Mardis" / "Every Tuesday"
                # For simplicity, let's assume recurrence is always weekly on a specific day.
                # The JSON should ideally provide the BYDAY value (e.g., "TU" for Tuesday).
                # Hardcoding for "newbie-training" as an example.
                rrule_byday = None
                if event_id == "newbie-training": # Assuming this is the only recurring one for now
                    rrule_byday = "TU" # Tuesday

                if rrule_byday:
                    today = date.today()
                    # Find the next occurrence of that weekday
                    event_date_for_dtstart = get_next_weekday(today, ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].index(rrule_byday))

                    dtstart_datetime = datetime.combine(event_date_for_dtstart, parsed_start_time)
                    e.begin = dtstart_datetime
                    e.rrule = f'FREQ=WEEKLY;BYDAY={rrule_byday}'

                    if parsed_end_time:
                        # Calculate duration if end time is available for the recurring event
                        duration_seconds = (datetime.combine(date.min, parsed_end_time) - datetime.combine(date.min, parsed_start_time)).total_seconds()
                        if duration_seconds < 0: # End time is on the next day (e.g. 10 PM - 2 AM)
                             duration_seconds += 24 * 3600
                        e.duration = timedelta(seconds=duration_seconds)
                    else:
                        e.duration = timedelta(hours=1) # Default duration for recurring if no end time
            else:
                print(f"Warning: Recurring event '{e.name}' has no time specified. Skipping.")
                continue # Cannot create a recurring event without a start time

        elif start_date_str:
            # Standard event with a start date
            try:
                event_start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()

                if parsed_start_time:
                    e.begin = datetime.combine(event_start_date, parsed_start_time)
                    if parsed_end_time:
                        # Determine if end_date_str is present and different
                        event_end_date_for_end_time = event_start_date
                        if end_date_str and end_date_str != start_date_str:
                             event_end_date_for_end_time = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        e.end = datetime.combine(event_end_date_for_end_time, parsed_end_time)
                    elif end_date_str and end_date_str != start_date_str: # Has end date but no specific end time, assume same time as start
                         event_end_date_for_end_time = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                         e.end = datetime.combine(event_end_date_for_end_time, parsed_start_time)
                    else: # No end time, no different end date
                        e.duration = timedelta(hours=2) # Default duration if only start time
                else:
                    # All-day event
                    e.begin = event_start_date
                    e.make_all_day()
                    if end_date_str and end_date_str != start_date_str:
                        event_end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        # For all-day events, DTEND is exclusive, so add one day
                        e.end = event_end_date + timedelta(days=1)
                    # If no end_date_str or same as start_date_str, it's a single all-day event, ics.py handles this by default.

            except ValueError:
                print(f"Warning: Could not parse date for event '{e.name}'. Skipping.")
                continue
        else:
            print(f"Warning: Event '{e.name}' has no startDate or recurrence. Skipping.")
            continue

        cal.events.add(e)

    # Ensure output directory exists
    if not os.path.exists(ics_output_dir):
        try:
            os.makedirs(ics_output_dir)
            print(f"Created directory: {ics_output_dir}")
        except OSError as exc: # Guard against race condition
            print(f"Error creating directory {ics_output_dir}: {exc}")
            return


    try:
        with open(ics_output_path, 'w', encoding='utf-8') as f:
            f.write(cal.serialize())
        print(f"Successfully generated {ics_output_path}")
    except Exception as e:
        print(f"Error writing ICS file {ics_output_path}: {e}")

if __name__ == '__main__':
    generate_ics()
    # Test the time parser
    # print(parse_time_str("19h30 - 20h30", 'fr'))
    # print(parse_time_str("7:30PM - 8:30PM", 'en'))
    # print(parse_time_str("19:30", 'fr'))
    # print(parse_time_str("10:00 AM", 'en'))
    # print(parse_time_str(None))
    # print(parse_time_str("Invalid Time String"))

    # today = date.today()
    # print(f"Today is {today} ({today.weekday()})")
    # print(f"Next Monday: {get_next_weekday(today, 0)}") # Monday
    # print(f"Next Tuesday: {get_next_weekday(today, 1)}") # Tuesday
    # print(f"Next Wednesday: {get_next_weekday(today, 2)}")
    # print(f"Next Sunday: {get_next_weekday(today, 6)}")
    # print(f"Next {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][today.weekday()]}: {get_next_weekday(today, today.weekday())}")
    # if date.today().weekday() == 1 : # If today is Tuesday
    #     print(f"Next Tuesday (should be today): {get_next_weekday(today, 1)}")
    #     print(f"Next Tuesday after a week: {get_next_weekday(today + timedelta(days=1), 1)}")
