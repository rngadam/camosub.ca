import json
import os
from datetime import datetime, timezone
from feedgen.feed import FeedGenerator

# Determine base URL from environment variable or use default
BASE_URL = os.environ.get('RSS_BASE_URL', 'https://camosub.ca')
# Ensure no trailing slash for consistency
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL[:-1]

# Define constants for file paths
BLOG_JSON_PATH = 'blog.json'
EVENTS_JSON_PATH = 'events.json'
BLOG_RSS_PATH = 'blog_rss.xml'
EVENTS_RSS_PATH = 'events_rss.xml'

def get_localized_value(item, key, default_lang='en', preferred_lang='fr'):
    """Safely retrieves a value from nested dictionaries based on language preference."""
    if preferred_lang in item and isinstance(item[preferred_lang], dict) and key in item[preferred_lang]:
        return item[preferred_lang][key]
    if default_lang in item and isinstance(item[default_lang], dict) and key in item[default_lang]:
        return item[default_lang][key]
    return None

def generate_blog_rss(blog_data_root):
    """Generates an RSS feed for blog posts."""
    fg = FeedGenerator()
    fg.title('Blog Posts')
    fg.link(href=f'{BASE_URL}/blog', rel='alternate')
    fg.description('Latest blog posts')

    actual_blog_data = None
    if isinstance(blog_data_root, dict) and 'posts' in blog_data_root:
        actual_blog_data = blog_data_root['posts']
    else:
        actual_blog_data = blog_data_root

    if isinstance(actual_blog_data, dict):
        blog_items = actual_blog_data.items()
    elif isinstance(actual_blog_data, list):
        blog_items = []
        for idx, post in enumerate(actual_blog_data):
            post_id = post.get('id', f"post-{idx}") if isinstance(post, dict) else f"post-{idx}"
            if isinstance(post, dict):
                blog_items.append((post_id, post))
            else:
                print(f"Skipping non-dictionary item in blog posts list: {post}")
                continue
    else:
        print("Error: Blog posts data is not in expected format (dict or list under 'posts' key, or at root).")
        return None

    if not blog_items:
        print("No blog items found to process.")
        return fg

    for post_id, post_details in blog_items:
        if not isinstance(post_details, dict):
            print(f"Skipping item with id {post_id} as its details are not a dictionary.")
            continue

        fe = fg.add_entry()

        title = get_localized_value(post_details, 'title')
        content = get_localized_value(post_details, 'content')

        if not title or not content:
            print(f"Skipping blog post {post_id} due to missing title or content.")
            continue

        fe.id(str(post_id))
        fe.title(title)
        fe.description(content)

        timestamp_str = post_details.get('timestamp')
        if timestamp_str:
            pub_datetime = None
            try:
                # Attempt to parse as numeric Unix timestamp first
                pub_datetime = datetime.fromtimestamp(int(float(timestamp_str)), timezone.utc)
            except (ValueError, TypeError):
                # If not a numeric timestamp, try parsing as ISO 8601 string
                try:
                    if isinstance(timestamp_str, str):
                        if timestamp_str.endswith('Z'):
                            # fromisoformat in 3.11+ handles Z, older might need replace
                            pub_datetime = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            pub_datetime = datetime.fromisoformat(timestamp_str)

                        # Ensure datetime is timezone-aware (UTC)
                        if pub_datetime.tzinfo is None:
                            pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                        else:
                            pub_datetime = pub_datetime.astimezone(timezone.utc)
                    else:
                        raise ValueError("Timestamp is not a string or number.")
                except ValueError:
                    print(f"Skipping blog post {post_id} due to invalid timestamp format: {timestamp_str}")
                    continue

            if pub_datetime:
                fe.pubDate(pub_datetime) # feedgen expects timezone-aware datetime

        fe.link(href=f'{BASE_URL}/blog/{post_id}', rel='alternate')

    return fg

def generate_events_rss(events_data_root):
    """Generates an RSS feed for events."""
    fg = FeedGenerator()
    fg.title('Events')
    fg.link(href=f'{BASE_URL}/events', rel='alternate')
    fg.description('Upcoming events')

    if isinstance(events_data_root, dict):
        event_items = events_data_root.items()
    elif isinstance(events_data_root, list):
        event_items = []
        for idx, event in enumerate(events_data_root):
            event_id = event.get('id', f"event-{idx}") if isinstance(event, dict) else f"event-{idx}"
            if isinstance(event, dict):
                event_items.append((event_id, event))
            else:
                print(f"Skipping non-dictionary item in events list: {event}")
                continue
    else:
        print("Error: Event data is not in expected format (dict or list).")
        return None

    if not event_items:
        print("No event items found to process.")
        return fg

    for event_id, event_details in event_items:
        if not isinstance(event_details, dict):
            print(f"Skipping item with id {event_id} as its details are not a dictionary.")
            continue

        fe = fg.add_entry()

        title = get_localized_value(event_details, 'title')
        description = get_localized_value(event_details, 'description')

        if not title or not description:
            print(f"Skipping event {event_id} due to missing title or description.")
            continue

        fe.id(str(event_id))
        fe.title(title)
        fe.description(description)

        start_date_str = event_details.get('startDate')
        if start_date_str:
            try:
                start_datetime = datetime.strptime(start_date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                fe.pubDate(start_datetime)
            except ValueError:
                print(f"Skipping event {event_id} due to invalid startDate format: {start_date_str}")
                continue

        event_url = event_details.get('url') or f'{BASE_URL}/events/{event_id}'
        fe.link(href=event_url, rel='alternate')

    return fg

def main():
    """Main function to generate RSS feeds."""
    # Create .github/scripts directory if it doesn't exist (for the script itself, though we are in it)
    # For output, assets directory will be created if needed by feedgen, or we save to root.
    # No, output is to root as per last correction.

    # Generate blog RSS feed
    try:
        with open(BLOG_JSON_PATH, 'r', encoding='utf-8') as f:
            blog_data = json.load(f)
        blog_fg = generate_blog_rss(blog_data)
        if blog_fg:
            blog_fg.rss_file(BLOG_RSS_PATH, pretty=True)
            print(f"Blog RSS feed generated successfully at {BLOG_RSS_PATH}")
    except FileNotFoundError:
        print(f"Error: Blog JSON file not found at {BLOG_JSON_PATH}")
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in {BLOG_JSON_PATH}")
    except Exception as e:
        print(f"An unexpected error occurred while generating the blog RSS feed: {e}")

    # Generate events RSS feed
    try:
        with open(EVENTS_JSON_PATH, 'r', encoding='utf-8') as f:
            events_data = json.load(f)
        events_fg = generate_events_rss(events_data)
        if events_fg:
            events_fg.rss_file(EVENTS_RSS_PATH, pretty=True)
            print(f"Events RSS feed generated successfully at {EVENTS_RSS_PATH}")
    except FileNotFoundError:
        print(f"Error: Events JSON file not found at {EVENTS_JSON_PATH}")
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in {EVENTS_JSON_PATH}")
    except Exception as e:
        print(f"An unexpected error occurred while generating the events RSS feed: {e}")

if __name__ == '__main__':
    main()
