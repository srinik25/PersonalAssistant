#!/usr/bin/env python3
"""
Batch runner: generates remaining nutrition profiles, updates index.html,
publishes to here.now, and sends SMS after each item.
"""

import json
import os
import smtplib
import subprocess
import sys
from email.mime.text import MIMEText

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from nutrition_generator import load_config, query_llm, validate_data, generate_html

WEEKLY_ITEMS = [
    "Cashews", "Tomatoes", "Tofu", "Almonds", "Turmeric", "Quinoa",
    "Sweet Potato", "Chickpeas", "Spinach", "Avocado", "Chia Seeds",
    "Lentils", "Broccoli", "Blueberries", "Walnuts", "Oats", "Kale",
]

TRACKER_FILE = os.path.join(BASE_DIR, "config", "daily_tracker.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
PUBLISH_SCRIPT = os.path.expanduser("~/.claude/skills/here-now/scripts/publish.sh")

GMAIL_USER = "srinikatta24@gmail.com"
APP_PASSWORD = "srck pbnk bvwe arcn"
SMS_RECIPIENTS = [
    "7038192545@tmomail.net",
    "7039896189@tmomail.net",
]


def update_index_html():
    """Regenerate index.html based on all .html files in output/."""
    files = sorted(f for f in os.listdir(OUTPUT_DIR) if f.endswith(".html") and f != "index.html")
    links = ""
    for f in files:
        name = f.replace(".html", "").replace("_", " ").title()
        links += f'            <a href="{f}">{name}</a>\n'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nutrition Profiles</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #e8f5e9 0%, #fff8e1 100%);
            color: #333;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        .container {{
            max-width: 600px;
            width: 100%;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #2e7d32, #43a047);
            color: white;
            padding: 30px 40px;
            text-align: center;
        }}
        .header h1 {{ font-size: 1.8rem; }}
        .header p {{ margin-top: 8px; opacity: 0.9; }}
        .list {{
            padding: 24px 40px 32px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }}
        .list a {{
            display: block;
            padding: 14px 18px;
            background: #f1f8e9;
            border-radius: 10px;
            text-decoration: none;
            color: #2e7d32;
            font-weight: 600;
            font-size: 1.05rem;
            transition: background 0.2s, transform 0.15s;
        }}
        .list a:hover {{
            background: #c8e6c9;
            transform: translateY(-2px);
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Nutrition Profiles</h1>
            <p>Explore detailed nutrition information for each food</p>
        </div>
        <div class="list">
{links}        </div>
    </div>
</body>
</html>"""
    with open(os.path.join(OUTPUT_DIR, "index.html"), "w") as f:
        f.write(html)


def publish_site():
    """Publish output dir to here.now and return the site URL."""
    result = subprocess.run(
        ["bash", PUBLISH_SCRIPT, OUTPUT_DIR, "--slug", "zingy-sleet-w3gr", "--client", "claude-code"],
        capture_output=True, text=True, timeout=60
    )
    print(result.stderr)
    for line in result.stderr.splitlines():
        if line.startswith("publish_result.site_url="):
            return line.split("=", 1)[1]
    # Fallback
    return result.stdout.strip().splitlines()[0] if result.stdout.strip() else "https://zingy-sleet-w3gr.here.now/"


def send_sms(food_name, site_url):
    """Send SMS to both recipients via email gateway."""
    body = f"New nutrition profile: {food_name}\n{site_url}"
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_USER, APP_PASSWORD)
        for recipient in SMS_RECIPIENTS:
            msg = MIMEText(body)
            msg["From"] = GMAIL_USER
            msg["To"] = recipient
            msg["Subject"] = f"{food_name} - Nutrition"
            server.sendmail(GMAIL_USER, recipient, msg.as_string())
            print(f"  SMS sent to {recipient}")


def main():
    # Load tracker
    if os.path.exists(TRACKER_FILE):
        with open(TRACKER_FILE) as f:
            tracker = json.load(f)
    else:
        tracker = {"day": 0, "history": []}

    start_day = tracker["day"]
    remaining = WEEKLY_ITEMS[start_day:]

    if not remaining:
        print("All items already processed.")
        return

    print(f"Processing {len(remaining)} remaining items: {remaining}\n")

    keys, system_prompt, profile, output_format = load_config()

    for i, food_item in enumerate(remaining):
        day_num = start_day + i
        print(f"=== [{day_num + 1}/{len(WEEKLY_ITEMS)}] {food_item} ===")

        # Generate
        data = query_llm(food_item, keys, system_prompt, profile, output_format)
        print(f"  Data received for '{data.get('name', food_item)}'")

        # Validate
        is_valid, issues = validate_data(data, food_item, keys)
        if is_valid:
            print("  Validation passed.")
        else:
            print(f"  Validation warnings ({len(issues)}), proceeding.")

        # Save HTML
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        filename = food_item.lower().replace(" ", "_") + ".html"
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, "w") as f:
            f.write(generate_html(data))
        print(f"  HTML saved: {filepath}")

        # Update tracker
        from datetime import datetime
        tracker["day"] = day_num + 1
        tracker["history"].append({"item": food_item, "date": datetime.now().isoformat()})
        with open(TRACKER_FILE, "w") as f:
            json.dump(tracker, f, indent=2)

        # Update index and publish
        update_index_html()
        print("  Publishing to here.now...")
        site_url = publish_site()
        print(f"  Published: {site_url}")

        # Send SMS
        send_sms(food_item, site_url)
        print()

    print(f"All done! {len(remaining)} items processed and published.")


if __name__ == "__main__":
    main()
