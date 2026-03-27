#!/usr/bin/env python3
"""
Daily Nutrition Email
Picks the next food item from the weekly list, generates a nutrition profile,
and emails it to recipients. Designed to run via cron at 10 AM daily for 1 week.
"""

import json
import os
import smtplib
import sys
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Add project dir to path so we can import the generator
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from nutrition_generator import load_config, query_llm, validate_data, generate_html

WEEKLY_ITEMS = [
    "Cashews",
    "Tomatoes",
    "Tofu",
    "Almonds",
    "Turmeric",
    "Quinoa",
    "Sweet Potato",
    "Chickpeas",
    "Spinach",
    "Avocado",
    "Chia Seeds",
    "Lentils",
    "Broccoli",
    "Blueberries",
    "Walnuts",
    "Oats",
    "Kale",
    "Edamame",
    "Pumpkin Seeds",
    "Mango",
    "Beetroot",
    "Cauliflower",
    "Black Beans",
    "Ginger",
    "Pomegranate",
    "Hemp Seeds",
    "Asparagus",
    "Moringa Leaves",
    "Drumstick",
    "Bamboo Shoots",
    "Raw Jackfruit",
    "Colcassia",
]

TRACKER_FILE = os.path.join(BASE_DIR, "config", "daily_tracker.json")


def get_next_item():
    """Get the next food item and update the tracker."""
    if os.path.exists(TRACKER_FILE):
        with open(TRACKER_FILE) as f:
            tracker = json.load(f)
    else:
        tracker = {"day": 0, "history": []}

    day = tracker["day"]
    if day >= len(WEEKLY_ITEMS):
        print("All 7 days completed. No more items to process.")
        return None

    item = WEEKLY_ITEMS[day]
    tracker["day"] = day + 1
    tracker["history"].append({"item": item, "date": datetime.now().isoformat()})

    with open(TRACKER_FILE, "w") as f:
        json.dump(tracker, f, indent=2)

    return item


def send_email(html_content, food_name, keys):
    """Send HTML email to all recipients."""
    email_cfg = keys["email"]
    sender = email_cfg["sender_email"]
    password = email_cfg["app_password"]
    recipients = email_cfg["recipients"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{food_name} - Daily Nutrition Profile"
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)

    msg.attach(MIMEText(f"Nutrition profile for {food_name}. View in HTML.", "plain"))
    msg.attach(MIMEText(html_content, "html"))

    with smtplib.SMTP(email_cfg["smtp_server"], email_cfg["smtp_port"]) as server:
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, recipients, msg.as_string())

    print(f"Email sent to: {', '.join(recipients)}")


def main():
    food_item = get_next_item()
    if food_item is None:
        return

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Today's item: {food_item}")

    keys, system_prompt, profile, output_format = load_config()

    # Generate
    data = query_llm(food_item, keys, system_prompt, profile, output_format)
    print(f"Received data for '{data.get('name', food_item)}'")

    # Validate
    is_valid, issues = validate_data(data, food_item, keys)
    if is_valid:
        print("Validation passed.")
    else:
        print(f"Validation warnings ({len(issues)}), proceeding with corrections.")

    # HTML
    html = generate_html(data)

    # Save
    output_dir = os.path.join(BASE_DIR, "output")
    os.makedirs(output_dir, exist_ok=True)
    filename = food_item.lower().replace(" ", "_") + ".html"
    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w") as f:
        f.write(html)
    print(f"HTML saved: {filepath}")

    # Email
    send_email(html, data.get("name", food_item), keys)
    print("Done!")


if __name__ == "__main__":
    main()
