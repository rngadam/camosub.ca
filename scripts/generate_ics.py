import json
from datetime import datetime, date, time, timedelta
from icalendar import Calendar, Event, vRecur # Updated import
import os
import re
import pytz

# --- Timezone Definition ---
TARGET_TZ = pytz.timezone("America/Montreal")

# --- Helper Functions ---
def parse_time_str(time_str):
    """
    Parses a time string like "19h30 - 20h30" or "7:30 PM - 8:30 PM" or "13h00".
    Returns (start_time, end_time) or (start_time, None) if only start is present or not a range.
    Times are returned as datetime.time objects.
    Handles 'h' separator and AM/PM.
    """
    if not time_str:
        return None, None

    time_str_upper = time_str.upper().replace(" ", "")

    # Regex to capture start and optional end time
    # Supports HH:MM, HHhMM, HH:MMAM/PM, HHhMMAM/PM
    # And ranges like HH:MM-HH:MM or HH:MMAM/PM-HH:MMAM/PM
    # Adjusted to better handle single times vs ranges
    pattern = re.compile(
        r"(\d{1,2})[H:]?(\d{2})(AM|PM)?"  # Start time
        r"(?:(?:-|–)(\d{1,2})[H:]?(\d{2})(AM|PM)?)?"  # Optional end time, allowing different dash types
    )
    match = pattern.match(time_str_upper)

    if not match:
        # Try parsing as a single time if range parsing fails (e.g. "19h30")
        single_time_pattern = re.compile(r"(\d{1,2})[H:]?(\d{2})(AM|PM)?")
        single_match = single_time_pattern.match(time_str_upper)
        if not single_match:
            print(f"Warning: Could not parse time string: {time_str}")
            return None, None

        start_hour_str, start_minute_str, start_ampm_str = single_match.groups()
        end_hour_str, end_minute_str, end_ampm_str = None, None, None
    else:
        start_hour_str, start_minute_str, start_ampm_str, \
        end_hour_str, end_minute_str, end_ampm_str = match.groups()

    def convert_to_time(hour_str, minute_str, ampm_str):
        if not hour_str or not minute_str:
            return None
        hour = int(hour_str)
        minute = int(minute_str)
        if ampm_str:
            if ampm_str == "PM" and hour < 12:
                hour += 12
            elif ampm_str == "AM" and hour == 12: # Midnight case 12 AM -> 00:00
                hour = 0
            elif ampm_str == "AM" and hour > 12: # e.g. 13:00 AM is invalid
                 return None # Invalid time
            elif ampm_str == "PM" and hour > 12 and hour != 12: # e.g. 13:00 PM is invalid if not 12 PM
                 if hour != 12 : # 12 PM is noon, valid
                      return None # Invalid time
        return time(hour, minute)

    parsed_start_time = convert_to_time(start_hour_str, start_minute_str, start_ampm_str)
    parsed_end_time = convert_to_time(end_hour_str, end_minute_str, end_ampm_str)

    if parsed_start_time is None: # If start time itself is invalid
        print(f"Warning: Could not parse start time from: {time_str}")
        return None, None

    return parsed_start_time, parsed_end_time

# --- Main Script Logic ---

def generate_ics():
    events_json_path = 'events.json'
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
    cal.add('prodid', '-//CAMO Subaquatique//icalendar-generator//EN')
    cal.add('version', '2.0')

    # Add X-properties with parameters using a tuple for key-value pairs
    cal.add('X-WR-CALNAME', 'CAMO Sports Subaquatiques', parameters={'language': 'fr'})
    cal.add('X-WR-CALNAME', 'CAMO Underwater Sports', parameters={'language': 'en'})
    cal.add('X-WR-CALDESC', 'Évènements de CAMO Sports Subaquatiques', parameters={'language': 'fr'})
    cal.add('X-WR-CALDESC', 'Events of CAMO Underwater Sports', parameters={'language': 'en'})
    cal.add('X-WR-TIMEZONE', TARGET_TZ.zone) # Correctly uses the string zone name
    cal.add('X-PUBLISHED-TTL', 'P1D')

    for ev_json in events_data:
        vevent = Event()
        event_id = ev_json.get('id', '')
        vevent.add('uid', f"{event_id}@{ev_json.get('domain', 'camosub.ca')}")

        fr_data = ev_json.get('fr', {})
        en_data = ev_json.get('en', {})

        # Determine preferred and fallback language for summary/description
        # This example prioritizes French if available, then English.
        summary = fr_data.get('title') or en_data.get('title') or 'Untitled Event'
        vevent.add('summary', summary)

        description_parts = []
        # Using new structured fields for description for newbie-training like events
        if event_id == 'newbie-training': # Example: customize description for this event
            if fr_data.get('programTitle'):
                description_parts.append(fr_data.get('programTitle'))
                if fr_data.get('programDetails'):
                    description_parts.extend([f"- {item}" for item in fr_data.get('programDetails', [])])
            if fr_data.get('cost'):
                description_parts.append(f"\nCoût (FR): {fr_data.get('cost')}")
            if fr_data.get('equipmentNeeded'):
                description_parts.append(f"Équipement (FR): {fr_data.get('equipmentNeeded')}")
            if fr_data.get('notes'):
                 description_parts.append(f"\nNotes (FR):\n{fr_data.get('notes')}")

            # Add English versions if preferred or for completeness
            if en_data.get('programTitle'):
                description_parts.append(f"\n{en_data.get('programTitle')}")
                if en_data.get('programDetails'):
                    description_parts.extend([f"- {item}" for item in en_data.get('programDetails', [])])
            if en_data.get('cost'):
                description_parts.append(f"\nCost (EN): {en_data.get('cost')}")
            if en_data.get('equipmentNeeded'):
                description_parts.append(f"Equipment (EN): {en_data.get('equipmentNeeded')}")
            if en_data.get('notes'):
                 description_parts.append(f"\nNotes (EN):\n{en_data.get('notes')}")

        else: # Fallback to general description fields for other events
            main_desc = fr_data.get('description') or en_data.get('description')
            if main_desc:
                description_parts.append(main_desc)
            details = fr_data.get('details') or en_data.get('details') # Assuming 'details' is plain text
            if details:
                description_parts.append(f"\n\nDetails:\n{details}")

        if description_parts:
            vevent.add('description', "\n".join(description_parts).strip())

        loc = ev_json.get('location', {})
        if loc:
            loc_parts = [loc.get('name'), loc.get('address'), loc.get('city'), loc.get('province'), loc.get('postalCode'), loc.get('country')]
            vevent.add('location', ", ".join(filter(None, loc_parts)))

        url = fr_data.get('url') or en_data.get('url')
        if url:
            vevent.add('url', url)

        start_date_str = ev_json.get('startDate')
        end_date_str = ev_json.get('endDate')
        time_str = ev_json.get('time')

        parsed_start_time, parsed_end_time = parse_time_str(time_str)

        rrule_str = ev_json.get('rrule')
        first_event_start_date_str = ev_json.get('firstEventStartDate')

        if rrule_str and first_event_start_date_str: # Recurring event
            if parsed_start_time:
                try:
                    first_event_date = datetime.strptime(first_event_start_date_str, '%Y-%m-%d').date()
                    naive_dt_start = datetime.combine(first_event_date, parsed_start_time)
                    vevent.add('dtstart', TARGET_TZ.localize(naive_dt_start))

                    rrule_obj = vRecur.from_ical(rrule_str)
                    vevent.add('rrule', rrule_obj)

                    if parsed_end_time:
                        naive_dt_end_on_start_date = datetime.combine(first_event_date, parsed_end_time)
                        if naive_dt_end_on_start_date <= naive_dt_start:
                            naive_dt_end_on_start_date += timedelta(days=1)
                        vevent.add('duration', naive_dt_end_on_start_date - naive_dt_start)
                    else: # Default duration for recurring if only start time is known
                        vevent.add('duration', timedelta(hours=1))
                except ValueError as ve:
                    print(f"Warning: Date/Time parsing error for recurring event '{summary}': {ve}. Skipping.")
                    continue
            else:
                print(f"Warning: Recurring event '{summary}' has no valid time. Skipping.")
                continue
        elif start_date_str: # Non-recurring event
            try:
                event_start_date_obj = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                if parsed_start_time: # Timed event
                    naive_dt_start = datetime.combine(event_start_date_obj, parsed_start_time)
                    vevent.add('dtstart', TARGET_TZ.localize(naive_dt_start))

                    if parsed_end_time:
                        event_end_date_obj = event_start_date_obj
                        if end_date_str and end_date_str != start_date_str:
                            event_end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        naive_dt_end = datetime.combine(event_end_date_obj, parsed_end_time)
                        if naive_dt_end <= naive_dt_start and event_end_date_obj == event_start_date_obj:
                             naive_dt_end += timedelta(days=1) # handle overnight
                        vevent.add('dtend', TARGET_TZ.localize(naive_dt_end))
                    elif end_date_str and end_date_str != start_date_str: # Multi-day, no specific end time
                        event_end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        naive_dt_end = datetime.combine(event_end_date_obj, parsed_start_time) # Assume same time as start
                        vevent.add('dtend', TARGET_TZ.localize(naive_dt_end))
                    else: # Single day, no specific end time
                        vevent.add('duration', timedelta(hours=2)) # Default duration
                else: # All-day event
                    vevent.add('dtstart', event_start_date_obj) # Pass date object
                    if end_date_str and end_date_str != start_date_str:
                        event_end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        vevent.add('dtend', event_end_date_obj + timedelta(days=1)) # DTEND is exclusive for multi-day all-day
                    # For single all-day, icalendar handles if dtend is not set or set to dtstart+1day
            except ValueError as ve:
                print(f"Warning: Date/Time parsing error for event '{summary}': {ve}. Skipping.")
                continue
        else:
            print(f"Warning: Event '{summary}' has insufficient date information. Skipping.")
            continue

        cal.add_component(vevent)

    try:
        # Use 'wb' for bytes as to_ical() returns bytes
        with open(ics_output_path, 'wb') as f:
            f.write(cal.to_ical())
        print(f"Successfully generated {ics_output_path}")
    except Exception as e:
        print(f"Error writing ICS file {ics_output_path}: {e}")

if __name__ == '__main__':
    generate_ics()
