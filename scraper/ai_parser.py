import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

# Pydantic item schema 
class ExtractedGear(BaseModel):
    category: str = Field(description="Must be exactly 'Shoe' or 'Cam'.")
    brand: str = Field(description="The brand of the item (e.g., Black Diamond, La Sportiva).")
    model: str = Field(description="The specific model of the item (e.g., Camalot C4, Solution).")
    price: float = Field(description="The current asking price as a number. If free, use 0.0.")
    size: str = Field(description="The size, length, or variation. Use 'N/A' if not applicable.")
    condition: str = Field(description="The condition of the item. Use 'Unknown' if not stated.")

# Pydantic post schema
class GearList(BaseModel):
    items: list[ExtractedGear] = Field(description="A list of all available gear items found in the post.")

def parse_gear_with_ai(raw_text: str):
    prompt = f"""
    You are an expert rock climbing gear extractor. 
    Review the following forum post text. 
    Extract every distinct piece of gear being sold.
    
    CRITICAL RULES:
    1. If an item is marked as "SOLD", do not include it in your output.
    2. If a price is missing, estimate it as 0.0.
    3. Infer the brand if it's obvious to a climber (e.g., 'C4' implies Black Diamond).
    4. STRICT FILTER: ONLY extract rock climbing shoes and cams (spring loaded camming devices). Completely ignore all other items (ropes, harnesses, clothing, carabiners, etc.).
    
    FORUM TEXT:
    {raw_text}
    """

    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite-preview',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GearList,
                temperature=0.1
            ),
        )
        
        data = json.loads(response.text)
        return data['items']
        
    except Exception as e:
        return []
