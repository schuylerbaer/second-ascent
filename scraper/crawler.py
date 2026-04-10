import requests
from bs4 import BeautifulSoup
from backend.app.db_client import supabase

FORUM_URL = "https://www.mountainproject.com/forum/103989416/for-sale-for-free-want-to-buy"

EXCLUDED_URLS = {
    "https://www.mountainproject.com/forum/topic/124725725",
    "https://www.mountainproject.com/forum/topic/123717568"
}

def normalize_url(url):
    """Strips the dynamic title slug off the URL so it never changes"""
    parts = url.split('?')[0].split('#')[0].split('/')
    if len(parts) >= 6:
        return f"https://www.mountainproject.com/forum/topic/{parts[5]}"
    return url

def get_new_listing_urls():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    response = requests.get(FORUM_URL, headers=headers)
    if response.status_code != 200:
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    
    post_links = []
    
    for a_tag in soup.select('table a[href*="/forum/topic/"]'):
        raw_url = a_tag.get('href')
        
        clean_url = normalize_url(raw_url)
        
        if clean_url not in post_links and "page=" not in raw_url and clean_url not in EXCLUDED_URLS:
            post_links.append(clean_url)

    existing_records = supabase.table('listings').select('url').in_('url', post_links).execute()
    known_urls = {record['url'] for record in existing_records.data}
    
    new_urls = [url for url in post_links if url not in known_urls]
    
    return new_urls
