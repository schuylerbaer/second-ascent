from backend.app.db_client import supabase

class GearMatcher:
    
    @staticmethod
    def _is_match(item_attributes: dict, alert_criteria: list) -> bool:
        """
        Smart matching logic to handle Gender (U/F/W), case-insensitivity, 
        and decimal sizing quirks (e.g., '42.0' vs '42').
        """
        for criteria in alert_criteria:
            key = criteria["key"]
            alert_val = str(criteria["value"]).strip().lower()
            item_val = str(item_attributes.get(key, "")).strip().lower()

            # 1. Gender Logic
            if key == "gender":
                if alert_val == "u":
                    continue
                if alert_val == "f" and item_val == "w":
                    continue
                if alert_val == "w" and item_val == "f":
                    continue
                if alert_val != item_val:
                    return False
                continue

            if key in ["size", "eu_size", "us_size"]:
                if item_val.replace(".0", "") == alert_val.replace(".0", ""):
                    continue
                return False

            if alert_val not in item_val and item_val not in alert_val:
                return False

        return True

    @staticmethod
    def check_new_item_against_alerts(new_item_attributes: dict, category_id: int):
        """
        Runs every time a new item is scraped. 
        Pulls active alerts and checks if there's a match.
        """
        response = supabase.table("alerts").select(
            "id", 
            "user_id", 
            "users(email)", 
            "alert_criteria(key, value)"
        ).eq("is_active", True).eq("category_id", category_id).execute()
        
        active_alerts = response.data
        users_to_notify = []

        for alert in active_alerts:
            criteria_list = alert.get("alert_criteria", [])
            if not criteria_list:
                continue

            if GearMatcher._is_match(new_item_attributes, criteria_list):
                users_to_notify.append({
                    "email": alert["users"]["email"],
                    "user_id": alert["user_id"],
                    "alert_id": alert["id"]
                })

        return users_to_notify

    @staticmethod
    def check_alert_against_recent_items(alert_criteria: list, category_id: int):
        """
        Runs during the cron sweep to check an alert against recently scraped items.
        Fetches the last 50 items in the category and checks for a match.
        """
        response = supabase.table("items").select(
            "id, listings(url), item_attributes(key, value)"
        ).eq("category_id", category_id).order("id", desc=True).limit(50).execute()
        
        matches = []
        for item in response.data:
            item_attrs = {attr["key"]: attr["value"] for attr in item.get("item_attributes", [])}
            
            if GearMatcher._is_match(item_attrs, alert_criteria):
                matches.append({
                    "item_id": item["id"],
                    "url": item["listings"]["url"] if item.get("listings") else "#",
                    "attributes": item_attrs
                })
                
        return matches
