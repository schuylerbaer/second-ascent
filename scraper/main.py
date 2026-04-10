import time
from datetime import datetime
from scraper.crawler import get_new_listing_urls
from scraper.extractor import extract_post_data
from scraper.matcher import GearMatcher
from scraper.ai_parser import parse_gear_with_ai
from scraper.notifier import EmailNotifier
from backend.app.db_client import supabase, get_or_create_parent_listing, insert_child_gear_item

CATEGORY_MAP = {
    "Shoe": 1,
    "Cam": 2
}

SOURCE_MP = 1

def run_scraper_pipeline():
    new_urls = get_new_listing_urls()

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Scraper ran. Found {len(new_urls)} new posts.")
    
    run_retroactive_alert_sweep()

    if not new_urls:
        return
    
    for url in new_urls:
        post_data = extract_post_data(url)
        if not post_data:
            continue

        try:
            listing_id = get_or_create_parent_listing(
                url=post_data['url'],
                source_id=SOURCE_MP,
                raw_text=post_data['raw_text'],
                author=post_data['author']
            )
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] ERROR on {url}: {e}")
            time.sleep(2)
            continue

        gear_items = parse_gear_with_ai(post_data['raw_text'])

        if not gear_items:
            time.sleep(2)
            continue

        try:
            for item_dict in gear_items:
                ai_category = item_dict.get('category')

                if not ai_category or ai_category not in CATEGORY_MAP:
                    continue

                mapped_category_id = CATEGORY_MAP[ai_category]

                attributes = {
                    "brand": str(item_dict.get("brand", "Unknown")),
                    "model": str(item_dict.get("model", "Unknown")),
                    "price": str(item_dict.get("price", "0.0")),
                    "condition": str(item_dict.get("condition", "Unknown")),
                    "size": str(item_dict.get("size", "N/A")),
                    "eu_size": str(item_dict.get("eu_size", "Unknown")),
                    "us_size": str(item_dict.get("us_size", "Unknown")),
                    "gender": str(item_dict.get("gender", "Unknown")),
                }

                saved_item_response = insert_child_gear_item(
                    listing_id=listing_id,
                    category_id=mapped_category_id,
                    attributes=attributes
                )

                if saved_item_response and hasattr(saved_item_response, 'data') and len(saved_item_response.data) > 0:
                    item_id = saved_item_response.data[0]['id']

                    matches = GearMatcher.check_new_item_against_alerts(
                        new_item_attributes=attributes,
                        category_id=mapped_category_id
                    )

                    if matches:
                        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Found {len(matches)} matches! Processing emails...")
                        for match in matches:
                            EmailNotifier.process_and_send(
                                user_email=match["email"],
                                user_id=match["user_id"],
                                alert_id=match["alert_id"],
                                item_id=item_id,
                                gear_data={**attributes, "url": post_data['url']}
                            )

                time.sleep(0.5)

        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] ERROR on {url}: {e}")
            time.sleep(2)
            continue

        time.sleep(2)


def run_retroactive_alert_sweep():
    """
    Sweeps all active alerts against recently scraped items.
    Relies on EmailNotifier to prevent duplicate emails.
    """
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Running retroactive alert sweep...")

    alerts_response = supabase.table("alerts").select(
        "id, user_id, users(email), category_id, alert_criteria(key, value)"
    ).eq("is_active", True).execute()

    for alert in alerts_response.data:
        alert_id = alert["id"]
        user_email = alert["users"]["email"]
        category_id = alert["category_id"]
        criteria = alert.get("alert_criteria", [])

        if not criteria:
            continue

        recent_matches = GearMatcher.check_alert_against_recent_items(criteria, category_id)

        for match in recent_matches:
            item_id = match["item_id"]
            gear_data = {**match["attributes"], "url": match["url"]}

            EmailNotifier.process_and_send(
                user_email=user_email,
                user_id=alert["user_id"],
                alert_id=alert_id,
                item_id=item_id,
                gear_data=gear_data
            )

if __name__ == "__main__":
    run_scraper_pipeline()
