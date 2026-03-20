import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_or_create_parent_listing(url: str, source_id: int, raw_text: str, author: str) -> int:
    data = {
        "url": url,
        "source_id": source_id,
        "raw_text": raw_text,
        "author": author,
    }
    
    response = supabase.table("listings").upsert(data, on_conflict="url").execute()
    
    if response.data:
        return response.data[0]['id']
    else:
        raise Exception(f"Failed to get/create listing ID for {url}")

def insert_child_gear_item(listing_id: int, category_id: int, attributes: dict):
    item_data = {
        "listing_id": listing_id,
        "category_id": category_id
    }

    item_response = supabase.table("items").insert(item_data).execute()

    if not item_response.data:
        raise Exception("Failed to insert into items table.")

    new_item_id = item_response.data[0]['id']

    attr_data_list = []

    for key, value in attributes.items():
        if value and value.strip() != "":
            attr_data_list.append({
                "item_id": new_item_id,
                "key": key,
                "value": str(value)
            })

    if attr_data_list:
        supabase.table("item_attributes").insert(attr_data_list).execute()

    return item_response
