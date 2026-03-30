#!/usr/bin/env python3
"""
Weekly article suggestions for Reading List.
Runs every Monday at 8 AM — fetches RSS from quality long-form sources,
picks 3-5 best matches via OpenAI, writes to Firestore as status:'suggested',
emails a summary.

Cron: 0 8 * * 1
"""

import json, re, smtplib, sys, subprocess
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from urllib.request import urlopen, Request

try:
    import feedparser
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'feedparser'], check=True)
    import feedparser

# ── Config ─────────────────────────────────────────────────────────────────

PROJECT_ID   = "nutrition-198dd"
FIREBASE_KEY = "AIzaSyDovFuXnRsL8Drf0EMkUrHqwNE-DDhMvXM"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/reading_links?key={FIREBASE_KEY}"
FIRESTORE_QUERY_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents:runQuery?key={FIREBASE_KEY}"

SECRETS = Path(__file__).parent.parent / "secrets.js"
OPENAI_KEY = ""
if SECRETS.exists():
    m = re.search(r'OPENAI_API_KEY\s*=\s*["\']([^"\']+)["\']', SECRETS.read_text())
    if m:
        OPENAI_KEY = m.group(1)

ENV_FILE = Path(__file__).parent.parent / "site" / ".env"
GMAIL_USER = ""
GMAIL_PASS = ""
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            if k.strip() == 'GMAIL_USER':     GMAIL_USER = v.strip()
            if k.strip() == 'GMAIL_APP_PASSWORD': GMAIL_PASS = v.strip()

NOTIFY_EMAIL = "srinikatta24@gmail.com"

# ── RSS sources — quality long-form journalism ──────────────────────────────

SOURCES = [
    {'name': 'Quanta Magazine',     'url': 'https://www.quantamagazine.org/feed/'},
    {'name': 'The Atlantic',        'url': 'https://feeds.feedburner.com/TheAtlantic'},
    {'name': 'Nautilus',            'url': 'https://nautil.us/feed/'},
    {'name': 'Aeon',                'url': 'https://aeon.co/feed.rss'},
    {'name': 'MIT Technology Review','url': 'https://www.technologyreview.com/feed/'},
    {'name': 'The New Yorker',      'url': 'https://www.newyorker.com/feed/everything'},
    {'name': 'Wired',               'url': 'https://www.wired.com/feed/rss'},
    {'name': 'Knowable Magazine',   'url': 'https://knowablemagazine.org/feed'},
]

VALID_CATEGORIES = [
    "physics_cosmos", "biology_life", "technology", "artificial_intelligence",
    "human_stories", "health_wellness", "exercises", "philosophy", "personal_growth",
    "economics_society", "travel", "personal_finance", "links", "other"
]

# ── Fetch feeds ─────────────────────────────────────────────────────────────

def fetch_feed(source):
    try:
        feed = feedparser.parse(source['url'])
        items = []
        for entry in feed.entries[:10]:
            title   = entry.get('title', '').strip()
            url     = entry.get('link', '').strip()
            summary = entry.get('summary', entry.get('description', ''))
            summary = re.sub(r'<[^>]+>', '', summary).strip()[:400]
            if not title or not url:
                continue
            items.append({'title': title, 'url': url, 'description': summary, 'source': source['name']})
        return items
    except Exception as e:
        print(f"  Error fetching {source['name']}: {e}")
        return []

# ── Get existing URLs from Firestore ────────────────────────────────────────

def get_existing_urls():
    try:
        query = {
            "structuredQuery": {
                "from": [{"collectionId": "reading_links"}],
                "select": {"fields": [{"fieldPath": "url"}]},
                "limit": 500
            }
        }
        req = Request(
            FIRESTORE_QUERY_URL,
            data=json.dumps(query).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        resp = urlopen(req, timeout=15)
        results = json.loads(resp.read())
        urls = set()
        for r in results:
            doc = r.get('document', {})
            url = doc.get('fields', {}).get('url', {}).get('stringValue', '')
            if url:
                urls.add(url)
        return urls
    except Exception as e:
        print(f"  Warning: could not fetch existing URLs: {e}")
        return set()

# ── Pick best articles via OpenAI ────────────────────────────────────────────

def pick_suggestions(candidates, existing_urls):
    # Filter already-saved URLs
    fresh = [c for c in candidates if c['url'] not in existing_urls]
    if not fresh:
        print("  No fresh candidates after dedup.")
        return []

    today = datetime.now().strftime('%Y-%m-%d')
    prompt = (
        f"Today is {today}. You are curating a personal reading list for Srini, "
        "who is interested in: science (physics, biology, space), AI & technology, "
        "philosophy, human stories & longform journalism, health, and economics.\n\n"
        "From the articles below, select the 4-5 most interesting and high-quality ones "
        "that cover a variety of topics. Avoid clickbait, listicles, and news briefs — "
        "prefer deep, thoughtful long-form pieces.\n\n"
        "Return a JSON object: {\"suggestions\": [ {title, url, description (2 sentences), category}, ... ]}\n"
        "category must be one of: " + ", ".join(VALID_CATEGORIES) + "\n\n"
        "Articles:\n" +
        "\n".join(f"{i+1}. [{c['source']}] {c['title']} — {c['url']}\n   {c['description'][:200]}"
                  for i, c in enumerate(fresh[:60]))
    )

    req = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps({
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
        }).encode(),
        headers={
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        }
    )
    resp = urlopen(req, timeout=60)
    data = json.loads(resp.read())
    content = json.loads(data["choices"][0]["message"]["content"])
    return content.get("suggestions", [])

# ── Write to Firestore ───────────────────────────────────────────────────────

def write_suggestion(item):
    body = {
        "fields": {
            "url":         {"stringValue": item["url"]},
            "title":       {"stringValue": item["title"]},
            "description": {"stringValue": item.get("description", "")},
            "category":    {"stringValue": item.get("category", "other") if item.get("category") in VALID_CATEGORIES else "other"},
            "status":      {"stringValue": "suggested"},
            "addedAt":     {"stringValue": datetime.utcnow().isoformat() + "Z"},
        }
    }
    req = Request(
        FIRESTORE_URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    urlopen(req, timeout=15)

# ── Email summary ────────────────────────────────────────────────────────────

def send_email(suggestions):
    if not GMAIL_USER or not GMAIL_PASS:
        print("  No email credentials — skipping email.")
        return
    lines = [f"• [{s.get('category','?')}] {s['title']}\n  {s['url']}" for s in suggestions]
    body = "Your weekly article suggestions are ready:\n\n" + "\n\n".join(lines) + \
           "\n\nhttps://silver-essence-gpqt.here.now/"
    msg = MIMEMultipart()
    msg["From"]    = GMAIL_USER
    msg["To"]      = NOTIFY_EMAIL
    msg["Subject"] = f"📚 {len(suggestions)} new article suggestions — {datetime.now().strftime('%b %d')}"
    msg.attach(MIMEText(body, "plain"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_PASS)
        server.sendmail(GMAIL_USER, NOTIFY_EMAIL, msg.as_string())
    print(f"  Email sent to {NOTIFY_EMAIL}")

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not OPENAI_KEY:
        print("ERROR: OPENAI_API_KEY not found in secrets.js")
        sys.exit(1)

    print(f"Fetching RSS from {len(SOURCES)} sources…")
    candidates = []
    for src in SOURCES:
        items = fetch_feed(src)
        print(f"  {src['name']}: {len(items)} items")
        candidates.extend(items)

    print(f"\nTotal candidates: {len(candidates)}")
    print("Fetching existing URLs from Firestore…")
    existing_urls = get_existing_urls()
    print(f"  {len(existing_urls)} existing URLs")

    print("\nAsking OpenAI to pick best suggestions…")
    suggestions = pick_suggestions(candidates, existing_urls)

    if not suggestions:
        print("No suggestions returned.")
        return

    print(f"\nWriting {len(suggestions)} suggestions to Firestore…")
    for s in suggestions:
        write_suggestion(s)
        print(f"  ✓ [{s.get('category','?'):20s}] {s['title'][:60]}")

    send_email(suggestions)
    print("\nDone.")

if __name__ == "__main__":
    main()
