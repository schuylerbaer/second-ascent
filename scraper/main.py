import time
from scraper.crawler import get_new_listing_urls
from scraper.extractor import extract_post_data
from scraper.ai_parser import parse_gear_with_ai
from backend.app.db_client import get_or_create_parent_listing, insert_child_gear_item

CATEGORY_MAP = {
    "Shoe": 1,
    "Cam": 2
}

SOURCE_MP = 1

def run_scraper_pipeline():
    new_urls = get_new_listing_urls()
    
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
                    "size": str(item_dict.get("size", "N/A")),
                    "condition": str(item_dict.get("condition", "Unknown"))
                }

                insert_child_gear_item(
                    listing_id=listing_id,
                    category_id=mapped_category_id,
                    attributes=attributes
                )
                time.sleep(0.5)

        except Exception as e:
            continue
        time.sleep(2)

if __name__ == "__main__":
    run_scraper_pipeline()
