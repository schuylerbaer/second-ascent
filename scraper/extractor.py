import requests
from bs4 import BeautifulSoup

def extract_post_data(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        return None
        
    soup = BeautifulSoup(response.text, 'html.parser')
    
    try:
        title_tag = soup.find('h1')
        title = title_tag.text.strip() if title_tag else "No Title Found"
        
        author_row = soup.find('tr', {'data-user-name': True})
        author = author_row['data-user-name'] if author_row else "Unknown Author"
        
        body_tag = soup.find('div', class_='fr-view') or soup.find('div', class_='message-body')
        
        if not body_tag:
            body_tag = soup.select_first('table.message-table td')
            
        if body_tag:
            for strike_tag in body_tag.find_all(['s', 'strike', 'del']):
                strike_tag.decompose()
                
            raw_text = body_tag.get_text(separator='\n', strip=True)
        else:
            raw_text = "Could not extract text."
        
        full_text = f"TITLE: {title}\n\nBODY:\n{raw_text}"
        
        return {
            "url": url,
            "author": author,
            "raw_text": full_text
        }
        
    except Exception as e:
        print(f"Error parsing HTML: {e}")
        return None
