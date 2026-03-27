#!/usr/bin/env python3
"""
Daily runner: generates the next nutrition profile, updates index.html,
publishes to here.now, and sends SMS with the new page link.
Designed to run once per day via crontab.
"""

import json
import os
import smtplib
import subprocess
import sys
from datetime import datetime
from email.mime.text import MIMEText

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from nutrition_generator import load_config, query_llm, validate_data, generate_html

ITEMS = [
    "Cashews", "Tomatoes", "Tofu", "Almonds", "Turmeric", "Quinoa",
    "Sweet Potato", "Chickpeas", "Spinach", "Avocado", "Chia Seeds",
    "Lentils", "Broccoli", "Blueberries", "Walnuts", "Oats", "Kale",
    "Edamame", "Pumpkin Seeds", "Mango", "Beetroot", "Cauliflower",
    "Black Beans", "Ginger", "Pomegranate", "Hemp Seeds", "Asparagus",
    "Moringa Leaves", "Drumstick", "Bamboo Shoots", "Raw Jackfruit", "Colcassia",
    "Macadamia Nuts",
]

TRACKER_FILE = os.path.join(BASE_DIR, "config", "daily_tracker.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
PUBLISH_SCRIPT = os.path.expanduser("~/.claude/skills/here-now/scripts/publish.sh")
SITE_SLUG = "wintry-tower-54cj"
SITE_URL = f"https://{SITE_SLUG}.here.now"

GMAIL_USER = "srinikatta24@gmail.com"
APP_PASSWORD = "srck pbnk bvwe arcn"
SMS_RECIPIENTS = [
    "7038192545@tmomail.net",
    "7039896189@tmomail.net",
]
EMAIL_FALLBACK = ["srini.katta@ymail.com", "arathi_dommeti@yahoo.com"]

LOG = os.path.join(BASE_DIR, "cron.log")


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def get_next_item():
    if os.path.exists(TRACKER_FILE):
        with open(TRACKER_FILE) as f:
            tracker = json.load(f)
    else:
        tracker = {"day": 0, "history": []}

    day = tracker["day"]
    if day >= len(ITEMS):
        return None, tracker

    item = ITEMS[day]
    tracker["day"] = day + 1
    tracker["history"].append({"item": item, "date": datetime.now().isoformat()})

    with open(TRACKER_FILE, "w") as f:
        json.dump(tracker, f, indent=2)

    return item, tracker


def update_index_html():
    # Emoji map for known foods; fallback to a leaf emoji
    emoji_map = {
        "almonds": "&#129372;",        # 🥜 peanut/nut
        "apples": "&#127822;",         # 🍎 apple
        "asparagus": "&#127793;",      # 🌱 seedling
        "avocado": "&#129361;",        # 🥑 avocado
        "bamboo shoots": "&#127885;",  # 🎍 bamboo
        "beetroot": "&#129364;",       # 🥔 root veggie
        "black beans": "&#129752;",    # 🫘 beans
        "blueberries": "&#129744;",    # 🫐 blueberries
        "broccoli": "&#129382;",       # 🥦 broccoli
        "cashews": "&#127792;",        # 🌰 chestnut (curved nut)
        "cauliflower": "&#127804;",    # 🌼 blossom (cauliflower floret)
        "chia seeds": "&#127793;",     # 🌱 seedling
        "chickpeas": "&#129752;",      # 🫘 beans
        "colcassia": "&#129364;",      # 🥔 potato (root veggie)
        "drumstick": "&#127807;",      # 🌿 herb
        "edamame": "&#129755;",        # 🫛 pea pod
        "flaxseeds": "&#127806;",      # 🌾 grain
        "ginger": "&#129754;",         # 🫚 ginger root
        "hemp seeds": "&#127793;",     # 🌱 seedling
        "kale": "&#129388;",           # 🥬 leafy green
        "lentils": "&#129379;",        # 🥣 bowl (lentil soup)
        "macadamia nuts": "&#127792;", # 🌰 chestnut (round nut)
        "mango": "&#129389;",          # 🥭 mango
        "moringa leaves": "&#127811;", # 🍃 leaves
        "oats": "&#129379;",           # 🥣 bowl (oatmeal)
        "pomegranate": "&#127826;",    # 🍒 cherry
        "pumpkin seeds": "&#127875;",  # 🎃 pumpkin
        "quinoa": "&#127806;",         # 🌾 grain
        "raw jackfruit": "&#127816;",  # 🍈 melon (similar shape)
        "spinach": "&#129388;",        # 🥬 leafy green
        "sweet potato": "&#127840;",   # 🍠 sweet potato
        "tofu": "&#129480;",           # 🧈 butter block (looks like tofu)
        "tomatoes": "&#127813;",       # 🍅 tomato
        "turmeric": "&#129754;",       # 🫚 ginger root (closest)
        "walnuts": "&#129372;",        # 🥜 peanut/nut
        "cinnamon": "&#129747;",       # 🫓 spice
        "black pepper": "&#9899;",     # ⚫ black circle
        "tempeh": "&#129480;",         # 🧈 block
        "miso": "&#129379;",           # 🥣 bowl
        "dates": "&#127796;",          # 🌴 palm tree
        "coconut": "&#129381;",        # 🥥 coconut
        "mushrooms": "&#127812;",      # 🍄 mushroom
        "saffron": "&#10024;",          # ✨ sparkle
        "yogurt": "&#129371;",          # 🥛 glass of milk
        "ragi": "&#127806;",              # 🌾 grain
        "peaches": "&#127825;",           # 🍑 peach
        "bananas": "&#127820;",           # 🍌 banana
        "basmati rice": "&#127858;",      # 🍲 rice
        "dark chocolate": "&#127851;",    # 🍫 chocolate
    }

    # Category mapping
    category_map = {
        "almonds": "nuts", "cashews": "nuts", "macadamia nuts": "nuts",
        "walnuts": "nuts", "chia seeds": "nuts", "flaxseeds": "nuts",
        "hemp seeds": "nuts", "pumpkin seeds": "nuts",
        "apples": "fruits", "avocado": "fruits", "blueberries": "fruits",
        "mango": "fruits", "pomegranate": "fruits", "raw jackfruit": "fruits",
        "bamboo shoots": "vegetables", "beetroot": "vegetables",
        "broccoli": "vegetables", "cauliflower": "vegetables",
        "colcassia": "vegetables", "drumstick": "vegetables",
        "kale": "vegetables", "moringa leaves": "vegetables",
        "spinach": "vegetables", "sweet potato": "vegetables",
        "tomatoes": "vegetables", "asparagus": "vegetables",
        "oats": "grains", "quinoa": "grains", "lentils": "grains",
        "chickpeas": "grains", "black beans": "grains", "edamame": "grains",
        "tofu": "other", "ginger": "other", "turmeric": "other",
        "cinnamon": "other", "black pepper": "other", "tempeh": "other",
        "miso": "other", "dates": "other", "coconut": "other", "mushrooms": "other",
        "saffron": "other", "yogurt": "other", "ragi": "grains",
        "peaches": "fruits", "bananas": "fruits", "basmati rice": "grains",
        "dark chocolate": "other",
    }

    # Load image map
    img_map_path = os.path.join(OUTPUT_DIR, "image_map.json")
    if os.path.exists(img_map_path):
        import json as _json
        with open(img_map_path) as _f:
            image_map = _json.load(_f)
    else:
        image_map = {}

    exclude = {"index.html", "add_recipe.html", "explainer.html"}
    files = sorted(f for f in os.listdir(OUTPUT_DIR) if f.endswith(".html") and f not in exclude)
    cards = ""
    for idx, f in enumerate(files):
        name = f.replace(".html", "").replace("_", " ").title()
        key = f.replace(".html", "")
        emoji = emoji_map.get(name.lower(), "&#127807;")
        cat = category_map.get(name.lower(), "other")
        delay = f"{0.03 * (idx + 1):.2f}"
        img_src = image_map.get(key, "")
        if img_src:
            visual = f'<img class="card-img" src="{img_src}" alt="{name}" loading="lazy">'
        else:
            visual = f'<span class="card-emoji">{emoji}</span>'
        cards += (
            f'            <a class="card" href="{f}" data-category="{cat}" style="animation-delay:{delay}s">\n'
            f'                {visual}\n'
            f'                <span class="card-name">{name}</span>\n'
            f'                <span class="card-arrow">View profile &#8594;</span>\n'
            f'            </a>\n'
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nourish &amp; Know | Plant-Based Guide</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f5f3f0;
            color: #1a1a2e;
            min-height: 100vh;
        }}
        .hero {{
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #1a2540 100%);
            color: white;
            padding: 32px 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }}
        .hero::before {{
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 30% 70%, rgba(212,163,115,0.08) 0%, transparent 50%),
                        radial-gradient(circle at 70% 30%, rgba(230,185,128,0.06) 0%, transparent 50%);
            animation: shimmer 15s ease-in-out infinite alternate;
        }}
        @keyframes shimmer {{
            0% {{ transform: translate(0, 0); }}
            100% {{ transform: translate(-5%, 5%); }}
        }}
        .hero-content {{
            position: relative; z-index: 1;
            max-width: 700px; margin: 0 auto;
        }}
        .hero-icon {{ font-size: 2rem; margin-bottom: 10px; display: block; }}
        .hero h1 {{
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 2.2rem; font-weight: 800;
            letter-spacing: -0.5px; margin-bottom: 8px; line-height: 1.1;
        }}
        .hero .subtitle {{
            font-size: 0.95rem; font-weight: 400; opacity: 0.85;
            line-height: 1.5; max-width: 520px; margin: 0 auto 14px;
        }}
        .hero .badge {{
            display: inline-block; padding: 6px 18px;
            background: rgba(212,163,115,0.2);
            border: 1px solid rgba(212,163,115,0.4);
            border-radius: 50px; font-size: 0.85rem;
            font-weight: 500; letter-spacing: 0.5px;
            backdrop-filter: blur(4px);
            color: #e6b980;
        }}
        .main {{
            max-width: 1100px; margin: -30px auto 0;
            padding: 0 24px 60px; position: relative; z-index: 2;
        }}
        .section-label {{
            text-align: center; font-size: 0.8rem; font-weight: 600;
            text-transform: uppercase; letter-spacing: 2px;
            color: #8a8494; margin-bottom: 28px; padding-top: 10px;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 20px;
        }}
        .card {{
            background: white; border-radius: 16px;
            padding: 28px 24px; text-decoration: none;
            color: #1a1a2e;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                        box-shadow 0.25s ease, border-color 0.25s ease;
            display: flex; flex-direction: column;
            align-items: flex-start; gap: 10px;
            border: 1px solid rgba(0,0,0,0.04);
            border-left: 3px solid transparent;
            opacity: 0; animation: fadeInUp 0.5s ease forwards;
        }}
        .card:hover {{
            transform: translateY(-6px);
            box-shadow: 0 8px 30px rgba(26,26,46,0.12), 0 2px 8px rgba(0,0,0,0.06);
            border-left-color: #d4a373;
        }}
        .card:hover .card-arrow {{
            opacity: 1; transform: translateX(0);
        }}
        .card-img {{
            width: 100%; height: 120px;
            object-fit: cover;
            border-radius: 10px;
            margin-bottom: 4px;
        }}
        .card-emoji {{ font-size: 2rem; line-height: 1; }}
        .card-name {{ font-weight: 700; font-size: 1.1rem; color: #1a1a2e; }}
        .card-arrow {{
            margin-top: auto; font-size: 0.85rem; color: #d4a373;
            font-weight: 600; opacity: 0; transform: translateX(-6px);
            transition: opacity 0.2s, transform 0.2s;
        }}
        @keyframes fadeInUp {{
            from {{ opacity: 0; transform: translateY(20px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}
        .footer {{
            background: #1a1a2e; color: rgba(255,255,255,0.6);
            text-align: center; padding: 36px 24px;
            font-size: 0.85rem; line-height: 1.7;
        }}
        .footer strong {{ color: rgba(255,255,255,0.85); font-weight: 600; }}
        .footer .footer-divider {{
            width: 40px; height: 2px;
            background: rgba(212,163,115,0.4);
            margin: 12px auto; border-radius: 1px;
        }}
        @media (max-width: 640px) {{
            .hero {{ padding: 40px 24px 30px; }}
            .hero h1 {{ font-size: 1.8rem; }}
            .hero .subtitle {{ font-size: 1rem; }}
            .grid {{ grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }}
            .card {{ padding: 20px 18px; }}
            .card-emoji {{ font-size: 1.6rem; }}
            .card-name {{ font-size: 1rem; }}
        }}
        .search-wrap {{
            max-width: 480px;
            margin: 0 auto 28px;
        }}
        .search-box {{
            width: 100%;
            padding: 14px 20px 14px 48px;
            font-family: 'Inter', sans-serif;
            font-size: 1rem;
            border: 1px solid #e0dcd6;
            border-radius: 50px;
            background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") 18px center no-repeat;
            color: #1a1a2e;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }}
        .search-box:focus {{
            border-color: #d4a373;
            box-shadow: 0 2px 12px rgba(212,163,115,0.15);
        }}
        .search-box::placeholder {{
            color: #aaa;
        }}
        .no-results {{
            text-align: center;
            padding: 40px 20px;
            color: #8a8494;
            font-size: 1rem;
            display: none;
        }}
        .tabs {{
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 24px;
            flex-wrap: wrap;
        }}
        .tab {{
            padding: 8px 20px;
            border-radius: 50px;
            border: 1px solid #e0dcd6;
            background: white;
            color: #6b7280;
            font-family: 'Inter', sans-serif;
            font-size: 0.88rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .tab:hover {{
            border-color: #d4a373;
            color: #d4a373;
        }}
        .tab.active {{
            background: #1a1a2e;
            color: #e6b980;
            border-color: #1a1a2e;
        }}
    </style>
</head>
<body>
    <div class="hero">
        <div class="hero-content">
            <h1>Nourish &amp; Know</h1>
            <p class="subtitle">Your guide to eating well &mdash; one food at a time.</p>
            <span class="badge">&#127807; Vegetarian &amp; Vegan Friendly</span>
        </div>
    </div>
    <div class="main">
        <div class="search-wrap">
            <input type="text" class="search-box" id="searchInput" placeholder="Search foods..." oninput="filterCards()">
        </div>
        <div class="tabs">
            <button class="tab active" onclick="setTab('all')">All</button>
            <button class="tab" onclick="setTab('nuts')">Nuts &amp; Seeds</button>
            <button class="tab" onclick="setTab('fruits')">Fruits</button>
            <button class="tab" onclick="setTab('vegetables')">Vegetables</button>
            <button class="tab" onclick="setTab('grains')">Grains &amp; Legumes</button>
            <button class="tab" onclick="setTab('other')">Other</button>
            <button class="tab" onclick="setTab('recipes')" style="border-color:#d4a373; color:#d4a373;">Recipes</button>
        </div>
        <div class="grid" id="foodGrid">
{cards}        </div>
        <div id="recipeSearchResults" style="margin-top:24px;"></div>
    </div>
    <p class="no-results" id="noResults">No results found.</p>
    <div id="recipesView" style="display:none; max-width:1100px; margin:0 auto; padding:0 24px 40px;">
        <p style="text-align:left; font-size:0.85rem; color:#8a8494; font-style:italic; letter-spacing:0.3px; margin-bottom:24px; padding:12px 0; border-bottom:1px solid #e8dfd4;">Personally curated and kitchen-tested recipes &mdash; no AI involved.</p>
        <div id="recipeCards" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px;"></div>
        <p id="recipesEmpty" style="text-align:center; padding:40px 20px; color:#8a8494; font-size:1.1rem;">Tasty treats coming soon .........</p>
    </div>
    <footer class="footer">
        <strong>Nourish &amp; Know</strong> &#8212; Mostly Plant-Based Nutrition Guide
        <div class="footer-divider"></div>
        <span style="font-size:0.85rem; opacity:0.9; font-weight:600;">* AI-generated content and auto-validated. Use at your own discretion.</span>
    </footer>
    <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
    <script>
    firebase.initializeApp({{
        apiKey: "AIzaSyDovFuXnRsL8Drf0EMkUrHqwNE-DDhMvXM",
        authDomain: "nutrition-198dd.firebaseapp.com",
        projectId: "nutrition-198dd",
        storageBucket: "nutrition-198dd.firebasestorage.app",
        messagingSenderId: "851241392706",
        appId: "1:851241392706:web:0738d4ac6e001e83a36bdb"
    }});
    const db = firebase.firestore();

    let activeTab = 'all';

    function setTab(tab) {{
        activeTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        filterCards();
    }}

    function filterCards() {{
        const query = document.getElementById('searchInput').value.toLowerCase().trim();
        const cards = document.querySelectorAll('#foodGrid .card');
        const grid = document.getElementById('foodGrid');
        const comingSoon = document.getElementById('comingSoon');

        const recipesView = document.getElementById('recipesView');
        if (activeTab === 'recipes') {{
            grid.style.display = 'none';
            recipesView.style.display = 'block';
            document.getElementById('noResults').style.display = 'none';
            renderRecipes();
            return;
        }}
        grid.style.display = '';
        recipesView.style.display = 'none';

        let visible = 0;
        cards.forEach(card => {{
            const name = card.querySelector('.card-name').textContent.toLowerCase();
            const cat = card.getAttribute('data-category');
            const matchesSearch = name.includes(query);
            const matchesTab = activeTab === 'all' || cat === activeTab;
            if (matchesSearch && matchesTab) {{
                card.style.display = '';
                visible++;
            }} else {{
                card.style.display = 'none';
            }}
        }});

        // Also search recipes from Firestore cache
        const recipeResults = document.getElementById('recipeSearchResults');
        if (query && (activeTab === 'all' || activeTab === 'recipes') && window._cachedRecipes) {{
            const matchingRecipes = window._cachedRecipes.filter(r =>
                r.name.toLowerCase().includes(query)
            );
            if (matchingRecipes.length > 0) {{
                recipeResults.innerHTML =
                    '<p style="font-size:0.8rem; font-weight:600; text-transform:uppercase; letter-spacing:2px; color:#8a8494; margin-bottom:16px;">Matching Recipes</p>' +
                    '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px;">' +
                    matchingRecipes.map(r => `
                        <div style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04);">
                            ${{r.photo ? `<img src="${{r.photo}}" style="width:100%; height:140px; object-fit:cover;">` : ''}}
                            <div style="padding:16px 20px;">
                                <h3 style="font-family:'Playfair Display',serif; color:#1a1a2e; font-size:1.1rem; margin-bottom:4px;">${{r.name}}</h3>
                                <span style="font-size:0.78rem; color:#d4a373; font-weight:600;">Recipe</span>
                            </div>
                        </div>
                    `).join('') + '</div>';
                visible += matchingRecipes.length;
            }} else {{
                recipeResults.innerHTML = '';
            }}
        }} else {{
            recipeResults.innerHTML = '';
        }}

        document.getElementById('noResults').style.display = visible === 0 ? 'block' : 'none';
    }}

    function checkAdmin() {{
        const pw = prompt('Enter admin password:');
        return pw === 'ashasrini';
    }}

    function toggleRecipeActions(card) {{
        const actions = card.querySelector('.recipe-actions');
        // Close all other open actions first
        document.querySelectorAll('.recipe-actions').forEach(a => {{
            if (a !== actions) a.style.display = 'none';
        }});
        actions.style.display = actions.style.display === 'none' ? 'flex' : 'none';
    }}

    function editRecipe(id) {{
        if (!checkAdmin()) return;
        // Fetch from Firestore, save to localStorage for editing
        db.collection('recipes').doc(id).get().then(doc => {{
            if (!doc.exists) return;
            const r = doc.data();
            const drafts = JSON.parse(localStorage.getItem('nk_drafts') || '{{}}');
            drafts[id] = {{ ...r, id: id, status: 'draft' }};
            localStorage.setItem('nk_drafts', JSON.stringify(drafts));
            localStorage.setItem('nk_last_edit', id);
            window.location.href = 'add_recipe.html?edit=' + id;
        }});
    }}

    function deleteRecipe(id) {{
        if (!checkAdmin()) return;
        db.collection('recipes').doc(id).delete().then(() => {{
            renderRecipes();
        }});
    }}

    function renderRecipes() {{
        const cards = document.getElementById('recipeCards');
        const empty = document.getElementById('recipesEmpty');
        cards.innerHTML = '<p style="text-align:center; color:#8a8494;">Loading recipes...</p>';
        db.collection('recipes').orderBy('publishedAt', 'desc').get().then(snapshot => {{
            const entries = [];
            snapshot.forEach(doc => {{
                entries.push({{ id: doc.id, ...doc.data() }});
            }});
            window._cachedRecipes = entries;
            if (entries.length === 0) {{
                cards.innerHTML = '';
                empty.style.display = 'block';
                return;
            }}
            empty.style.display = 'none';
            cards.innerHTML = entries.map(r => `
                <div class="recipe-card" style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04); cursor:pointer;" onclick="toggleRecipeActions(this)">
                    ${{r.photo ? `<img src="${{r.photo}}" style="width:100%; height:180px; object-fit:cover;">` : ''}}
                    <div style="padding:20px 24px;">
                        <h3 style="font-family:'Playfair Display',serif; color:#1a1a2e; font-size:1.2rem; margin-bottom:12px;">${{r.name}}</h3>
                        <h4 style="color:#d4a373; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Ingredients</h4>
                        <p style="color:#4a5568; font-size:0.9rem; line-height:1.6; white-space:pre-line; margin-bottom:14px;">${{r.ingredients}}</p>
                        <h4 style="color:#d4a373; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Method</h4>
                        <p style="color:#4a5568; font-size:0.9rem; line-height:1.6; white-space:pre-line;">${{r.method}}</p>
                        <div class="recipe-actions" style="display:none; margin-top:16px; padding-top:14px; border-top:1px solid #e8dfd4; text-align:right;">
                            <button onclick="event.stopPropagation(); editRecipe('${{r.id}}')" style="padding:8px 16px; border:1px solid #e0dcd6; border-radius:50px; background:white; color:#1a1a2e; font-size:0.85rem; font-weight:600; cursor:pointer; margin-right:8px;">&#9998; Edit</button>
                            <button onclick="event.stopPropagation(); deleteRecipe('${{r.id}}')" style="padding:8px 16px; border:1px solid #fee2e2; border-radius:50px; background:#fee2e2; color:#991b1b; font-size:0.85rem; font-weight:600; cursor:pointer;">&#128465; Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }});
    }}

    // Pre-load recipes for search
    db.collection('recipes').get().then(snapshot => {{
        window._cachedRecipes = [];
        snapshot.forEach(doc => {{
            window._cachedRecipes.push({{ id: doc.id, ...doc.data() }});
        }});
    }});
    </script>
</body>
</html>"""
    with open(os.path.join(OUTPUT_DIR, "index.html"), "w") as f:
        f.write(html)


def publish():
    result = subprocess.run(
        ["bash", PUBLISH_SCRIPT, OUTPUT_DIR, "--slug", SITE_SLUG, "--client", "claude-code"],
        capture_output=True, text=True, timeout=120
    )
    log(f"Publish output: {result.stderr.strip()}")
    return SITE_URL


def send_sms(food_name):
    filename = food_name.lower().replace(" ", "_") + ".html"
    page_url = f"{SITE_URL}/{filename}"
    body = f"New nutrition profile: {food_name}\n{page_url}"
    failed_numbers = []

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_USER, APP_PASSWORD)
            for recipient in SMS_RECIPIENTS:
                try:
                    msg = MIMEText(body)
                    msg["From"] = GMAIL_USER
                    msg["To"] = recipient
                    msg["Subject"] = f"{food_name} - Nourish & Know"
                    server.sendmail(GMAIL_USER, recipient, msg.as_string())
                    log(f"SMS sent to {recipient}")
                except Exception as e:
                    log(f"SMS failed for {recipient}: {e}")
                    failed_numbers.append(recipient)
    except Exception as e:
        log(f"SMS connection error: {e}")
        failed_numbers = list(SMS_RECIPIENTS)

    # Fallback: send via email if any SMS failed
    if failed_numbers:
        send_email_fallback(food_name, page_url)


def send_email_fallback(food_name, page_url):
    from email.mime.multipart import MIMEMultipart
    log(f"Falling back to email for {food_name}")
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_USER, APP_PASSWORD)
            for recipient in EMAIL_FALLBACK:
                msg = MIMEMultipart("alternative")
                msg["From"] = GMAIL_USER
                msg["To"] = recipient
                msg["Subject"] = f"{food_name} - Nourish & Know"
                html_body = (
                    f"<p>A new nutrition profile for <strong>{food_name}</strong> has been published.</p>"
                    f'<p><a href="{page_url}">View {food_name} Profile</a></p>'
                    f'<p><a href="{SITE_URL}">View All Profiles</a></p>'
                )
                msg.attach(MIMEText(html_body, "html"))
                server.sendmail(GMAIL_USER, recipient, msg.as_string())
                log(f"Email fallback sent to {recipient}")
    except Exception as e:
        log(f"Email fallback error: {e}")


def main():
    log("=== Daily nutrition run starting ===")

    food_item, tracker = get_next_item()
    if food_item is None:
        log("All items processed. Nothing to do.")
        return

    log(f"Today's item: {food_item} (day {tracker['day']}/{len(ITEMS)})")

    # Generate
    keys, system_prompt, profile, output_format = load_config()
    data = query_llm(food_item, keys, system_prompt, profile, output_format)
    log(f"Data received for '{data.get('name', food_item)}'")

    # Validate
    is_valid, issues = validate_data(data, food_item, keys)
    log(f"Validation: {'passed' if is_valid else f'{len(issues)} warnings'}")

    # Save HTML
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filename = food_item.lower().replace(" ", "_") + ".html"
    filepath = os.path.join(OUTPUT_DIR, filename)
    # Check for image
    img_key = food_item.lower().replace(" ", "_")
    img_map_path = os.path.join(OUTPUT_DIR, "image_map.json")
    img_path = None
    if os.path.exists(img_map_path):
        with open(img_map_path) as imf:
            img_path = json.load(imf).get(img_key)
    with open(filepath, "w") as f:
        f.write(generate_html(data, image_path=img_path))
    log(f"HTML saved: {filepath}")

    # Update index and publish
    update_index_html()
    publish()
    log(f"Published to {SITE_URL}")

    # Send SMS
    send_sms(food_item)

    log("=== Done ===\n")


if __name__ == "__main__":
    main()
