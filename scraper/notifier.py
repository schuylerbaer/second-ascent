import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
from backend.app.db_client import supabase

load_dotenv()

SENDER_EMAIL = os.environ.get("SENDER_EMAIL")
APP_PASSWORD = os.environ.get("APP_PASSWORD")

class EmailNotifier:

    @staticmethod
    def process_and_send(user_email: str, user_id: str, alert_id: int, item_id: int, gear_data: dict):
        try:
            supabase.table("sent_notifications").insert({
                "user_id": user_id,
                "item_id": item_id
            }).execute()
        except Exception as e:
            if '23505' in str(e) or 'duplicate key' in str(e).lower():
                print(f"User {user_email} already notified about Item {item_id}. Skipping overlap.")
                return
            print(f"Database error claiming lock for User {user_email}: {e}")
            return

        brand = gear_data.get('brand', 'Unknown Brand')
        model = gear_data.get('model', 'Unknown Model')
        url = gear_data.get('url', '#')
        
        # --- PRICE FORMATTING LOGIC ---
        raw_price = gear_data.get('price', '0.0')
        try:
            # Forces exactly 2 decimal places (e.g. 90.0 -> 90.00)
            display_price = f"{float(raw_price):.2f}"
        except ValueError:
            # Fallback if the AI extracted text like "Make an offer"
            display_price = str(raw_price)
            
        # --- SMART SIZE LOGIC ---
        base_size = gear_data.get('size', 'N/A')
        eu_size = gear_data.get('eu_size', 'Unknown')
        us_size = gear_data.get('us_size', 'Unknown')
        
        if base_size != 'N/A':
            # It's a cam or other hardware
            display_size = base_size 
        else:
            # It's a shoe, format the EU/US sizes nicely
            shoe_sizes = []
            if eu_size != 'Unknown': shoe_sizes.append(f"EU {eu_size}")
            if us_size != 'Unknown': shoe_sizes.append(f"US {us_size}")
            display_size = " / ".join(shoe_sizes) if shoe_sizes else "Unknown"

        msg = EmailMessage()
        msg['Subject'] = f"Gear Hunter Alert: {brand} {model} for ${display_price}!"
        msg['From'] = SENDER_EMAIL
        msg['To'] = user_email
        
        msg.set_content(f"""
Hey there!

Your Gear Hunter alert found a match:

Brand: {brand}
Model: {model}
Size: {display_size}
Price: ${display_price}
Condition: {gear_data.get('condition', 'Unknown')}

Check out the post here: {url}

- The Gear Hunter Bot
""")

        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(SENDER_EMAIL, APP_PASSWORD)
                smtp.send_message(msg)
                
            print(f"Email successfully sent to {user_email} for {brand} {model}!")

        except Exception as e:
            print(f"ERROR --- failed to send email to {user_email}: {e}")
