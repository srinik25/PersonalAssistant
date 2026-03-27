#!/usr/bin/env python3
"""
Nutrition Generator
Takes a food item as input, queries GPT-4o for nutritional info,
validates the response for accuracy, and generates a styled HTML file.
"""

import json
import os
import re
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from openai import OpenAI

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "config")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")


# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------

def load_config():
    """Load all config files."""
    with open(os.path.join(CONFIG_DIR, "keys.txt")) as f:
        keys_raw = f.read().strip()
        keys = json.loads("{" + keys_raw + "}")

    with open(os.path.join(CONFIG_DIR, "system_prompt.json")) as f:
        system_prompt = json.load(f)

    with open(os.path.join(CONFIG_DIR, "profile.json")) as f:
        profile = json.load(f)

    with open(os.path.join(CONFIG_DIR, "output.json")) as f:
        output_format = json.load(f)

    return keys, system_prompt, profile, output_format


# ---------------------------------------------------------------------------
# LLM query
# ---------------------------------------------------------------------------

def get_client(keys):
    """Create and return an OpenAI client."""
    return OpenAI(api_key=keys["chatgpt"]["api_key"])


def query_llm(food_item, keys, system_prompt, profile, output_format):
    """Call OpenAI API to get nutrition data for the food item."""
    client = get_client(keys)
    model = keys["chatgpt"]["model_name"]

    fmt = output_format["response_format"]
    system_message = (
        f"You are a {system_prompt['role']}.\n"
        f"Guidelines: {json.dumps(system_prompt['guidelines'])}\n"
        f"User profile: {json.dumps(profile)}\n\n"
        f"IMPORTANT: Respond ONLY with valid JSON matching this exact format:\n"
        f"{json.dumps(fmt['fields'], indent=2)}\n\n"
        f"Here is a complete example of the expected output:\n"
        f"{json.dumps(fmt['example'], indent=2)}\n\n"
        "Fill in ALL fields with accurate, evidence-based data. "
        "Return ONLY the JSON object, no markdown fences or extra text."
    )

    user_message = (
        f"Give me the complete nutritional profile for: {food_item}\n"
        "Include history, native country, full nutrition profile with serving size, "
        "daily intake, best time to eat, meal incorporation suggestions, "
        "and a vegetarian recipe using this food item. "
        "Prefer Indian, Middle Eastern, or Asian-style recipes (e.g., dal, biryani, curry, stir-fry, chai). "
        "Vegetarian means dairy like ghee, yogurt, milk, and paneer are fine — do NOT restrict to vegan. "
        "Tailor everything for a vegetarian diet.\n\n"
        "CRITICAL for daily_intake: The tsp, tbsp, and cup values MUST be equivalent "
        "conversions of the SAME recommended daily amount. For example, if the daily "
        "recommendation is 2 tablespoons, then tsp should be 6 teaspoons (since 1 tbsp = 3 tsp) "
        "and cup should be 1/8 cup (since 16 tbsp = 1 cup). Double-check unit conversions.\n\n"
        "For the recipe: include name, short description, prep_time, cook_time, servings, "
        "ingredients list, and step-by-step instructions list.\n\n"
        "For meal_incorporation, also include an 'additional_notes' array with 2-3 practical, "
        "evidence-based tips about this food — e.g., preparation tips (soaking, sprouting), "
        "anti-nutrient reduction, absorption enhancers (food pairings), storage advice, "
        "or who should limit intake. Be specific and actionable."
    )

    print(f"Querying GPT-4o for '{food_item}'...")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    content = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0].strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Retry once on parse failure
        print(f"  JSON parse error, retrying...")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            content = content.rsplit("```", 1)[0].strip()
        return json.loads(content)


# ---------------------------------------------------------------------------
# Validator module
# ---------------------------------------------------------------------------

def validate_data(data, food_item, keys):
    """
    Validate the LLM output for accuracy. Runs multiple checks:
    1. Structure check  — all required fields present
    2. Numeric check    — calorie/macro numbers are reasonable
    3. Unit consistency — daily intake tsp/tbsp/cup are equivalent
    4. LLM cross-check  — ask the LLM to verify its own data
    Returns (is_valid, list_of_issues).
    """
    issues = []

    # --- 1. Structure check ---
    required_top = ["name", "history", "native_country", "nutrition_profile",
                     "daily_intake", "best_time_to_eat", "meal_incorporation", "recipe"]
    for field in required_top:
        if field not in data or not data[field]:
            issues.append(f"Missing or empty field: {field}")

    np = data.get("nutrition_profile", {})
    for field in ["serving_size", "calories", "protein", "fiber", "fat", "carbohydrates"]:
        if field not in np or not np[field]:
            issues.append(f"Missing nutrition_profile.{field}")

    recipe = data.get("recipe", {})
    for field in ["name", "ingredients", "instructions"]:
        if field not in recipe or not recipe[field]:
            issues.append(f"Missing recipe.{field}")

    # --- 2. Numeric reasonableness check ---
    def extract_number(text):
        """Extract the first number from a string."""
        if isinstance(text, (int, float)):
            return float(text)
        match = re.search(r"[\d.]+", str(text))
        return float(match.group()) if match else None

    cal = extract_number(np.get("calories", ""))
    if cal is not None:
        if cal < 1 or cal > 900:
            issues.append(f"Calories ({cal}) seems unreasonable for a single serving")

    protein = extract_number(np.get("protein", ""))
    fat = extract_number(np.get("fat", ""))
    carbs = extract_number(np.get("carbohydrates", ""))
    if all(v is not None for v in [protein, fat, carbs]):
        computed_cal = protein * 4 + fat * 9 + carbs * 4
        if cal is not None and abs(computed_cal - cal) > cal * 0.35:
            issues.append(
                f"Calorie mismatch: stated {cal} kcal but macros suggest ~{computed_cal:.0f} kcal "
                f"(P:{protein}g F:{fat}g C:{carbs}g)"
            )

    # --- 3. Unit consistency check ---
    intake = data.get("daily_intake", {})
    tsp_val = extract_number(intake.get("tsp", ""))
    tbsp_val = extract_number(intake.get("tbsp", ""))
    cup_val = extract_number(intake.get("cup", ""))

    if tsp_val and tbsp_val:
        expected_tsp = tbsp_val * 3
        if abs(tsp_val - expected_tsp) > 1.5:
            issues.append(
                f"Unit mismatch: {tbsp_val} tbsp should be ~{expected_tsp} tsp, got {tsp_val} tsp"
            )

    # --- 4. LLM cross-check ---
    print("Validating data with LLM cross-check...")
    client = get_client(keys)
    model = keys["chatgpt"]["model_name"]

    try:
        np_json = json.dumps(data.get("nutrition_profile", {}), indent=2, ensure_ascii=True)
        intake_json = json.dumps(data.get("daily_intake", {}), indent=2, ensure_ascii=True)
    except (TypeError, ValueError):
        np_json = str(data.get("nutrition_profile", {}))
        intake_json = str(data.get("daily_intake", {}))

    verify_prompt = (
        f"You are a nutrition fact-checker. Verify the following nutritional data for "
        f"'{food_item}'. Check if the values are accurate based on established nutritional "
        f"databases (USDA, etc.).\n\n"
        f"Data to verify:\n{np_json}\n"
        f"Daily intake: {intake_json}\n\n"
        "Respond ONLY with valid JSON in this format:\n"
        '{"accurate": true/false, "issues": ["issue1", "issue2"], "corrections": {"field": "corrected_value"}}\n'
        "If everything looks accurate, return {\"accurate\": true, \"issues\": [], \"corrections\": {}}"
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": verify_prompt}],
            temperature=0.1,
        )
    except Exception as e:
        print(f"  Cross-check API error: {e}")
        return len(issues) == 0, issues

    verify_content = response.choices[0].message.content.strip()
    if verify_content.startswith("```"):
        verify_content = verify_content.split("\n", 1)[1]
        verify_content = verify_content.rsplit("```", 1)[0].strip()

    try:
        verification = json.loads(verify_content)
        if not verification.get("accurate", True):
            for issue in verification.get("issues", []):
                issues.append(f"[LLM cross-check] {issue}")
            # Apply corrections (only accept clean values, not commentary)
            corrections = verification.get("corrections", {})
            if corrections:
                print(f"Applying {len(corrections)} correction(s) from cross-check...")
                for field, value in corrections.items():
                    # Skip corrections that are commentary rather than clean values
                    if isinstance(value, str) and any(word in value.lower() for word in [
                        "likely", "usda", "too high", "too low", "should be",
                        "incorrect", "actually", "approximately", "around",
                        "according", "note", "however", "but "
                    ]):
                        print(f"  Skipping commentary correction for '{field}': {value[:60]}...")
                        continue
                    if field in np:
                        if isinstance(np[field], list) and isinstance(value, list):
                            np[field] = value
                        elif not isinstance(np[field], list) and not isinstance(value, list):
                            np[field] = value
                        else:
                            print(f"  Skipping correction for '{field}' (type mismatch)")
                    elif field in intake:
                        intake[field] = value
    except json.JSONDecodeError:
        issues.append("[LLM cross-check] Could not parse verification response")

    is_valid = len(issues) == 0
    return is_valid, issues


# ---------------------------------------------------------------------------
# HTML generator
# ---------------------------------------------------------------------------

def generate_html(data, image_path=None):
    """Generate a styled HTML page from nutrition data."""
    name = data.get("name", "Unknown")

    def render_list(items):
        if not items:
            return ""
        return "".join(f"<li>{item}</li>" for item in items)

    def render_numbered_list(items):
        if not items:
            return ""
        return "".join(f"<li>{item}</li>" for item in items)

    np = data.get("nutrition_profile", {})
    intake = data.get("daily_intake", {})
    meals = data.get("meal_incorporation", {})
    suggestions = meals.get("suggestions", [])
    recipe = data.get("recipe", {})

    recipe_html = ""
    if recipe and recipe.get("name"):
        recipe_html = f"""
            <div class="section card animate-in" style="animation-delay:0.6s">
                <h2>&#127859; Recipe: {recipe.get('name', '')}</h2>
                <p class="recipe-desc">{recipe.get('description', '')}</p>
                <div class="recipe-meta">
                    <div class="meta-item">
                        <span class="meta-icon">&#9202;</span>
                        <span class="meta-label">Prep</span>
                        <span class="meta-value">{recipe.get('prep_time', 'N/A')}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">&#128293;</span>
                        <span class="meta-label">Cook</span>
                        <span class="meta-value">{recipe.get('cook_time', 'N/A')}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">&#127860;</span>
                        <span class="meta-label">Servings</span>
                        <span class="meta-value">{recipe.get('servings', 'N/A')}</span>
                    </div>
                </div>
                <h3>Ingredients</h3>
                <ul>{render_list(recipe.get('ingredients', []))}</ul>
                <h3>Instructions</h3>
                <ol class="instructions">{render_numbered_list(recipe.get('instructions', []))}</ol>
            </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name} - Nutrition Profile</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f5f3f0;
            color: #1a1a2e;
            min-height: 100vh;
        }}

        /* Back navigation */
        .back-nav {{
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(26, 26, 46, 0.95);
            backdrop-filter: blur(10px);
            z-index: 100;
            padding: 0 24px;
        }}
        .back-nav a {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: rgba(255,255,255,0.85);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            padding: 14px 0;
            transition: color 0.2s;
        }}
        .back-nav a:hover {{ color: #e6b980; }}

        /* Hero header */
        .hero {{
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #1a2540 100%);
            color: white;
            padding: 100px 40px 50px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }}
        .hero::before {{
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 30% 70%, rgba(212,163,115,0.08) 0%, transparent 50%),
                        radial-gradient(circle at 70% 30%, rgba(230,185,128,0.06) 0%, transparent 50%);
        }}
        .hero-content {{
            position: relative;
            z-index: 1;
        }}
        .hero-img {{
            width: 140px;
            height: 140px;
            object-fit: cover;
            border-radius: 50%;
            border: 4px solid rgba(212,163,115,0.4);
            margin-bottom: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }}
        .hero h1 {{
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 2.8rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin-bottom: 10px;
        }}
        .hero .subtitle {{
            font-size: 1.05rem;
            opacity: 0.8;
            font-weight: 400;
        }}
        .hero .badge {{
            display: inline-block;
            margin-top: 14px;
            padding: 5px 16px;
            background: rgba(212,163,115,0.2);
            border: 1px solid rgba(212,163,115,0.4);
            border-radius: 50px;
            font-size: 0.8rem;
            font-weight: 500;
            letter-spacing: 0.5px;
            color: #e6b980;
        }}

        /* Main layout */
        .main {{
            max-width: 860px;
            margin: -28px auto 0;
            padding: 0 24px 60px;
            position: relative;
            z-index: 2;
        }}

        /* Cards / Sections */
        .section {{
            margin-bottom: 24px;
        }}
        .card {{
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
            border: 1px solid rgba(0,0,0,0.04);
        }}
        .section h2 {{
            font-family: 'Playfair Display', Georgia, serif;
            color: #1a1a2e;
            font-size: 1.35rem;
            font-weight: 700;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e8dfd4;
        }}
        .section h3 {{
            color: #d4a373;
            font-size: 0.95rem;
            font-weight: 600;
            margin-top: 18px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .section p {{
            line-height: 1.75;
            color: #4a5568;
            font-size: 0.95rem;
        }}

        /* Nutrition grid */
        .nutrition-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 14px;
        }}
        .nutrition-item {{
            background: linear-gradient(135deg, #f8f6f3, #f3efe9);
            padding: 16px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e8dfd4;
        }}
        .nutrition-item strong {{
            display: block;
            color: #16213e;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }}
        .nutrition-item span {{
            font-size: 1.05rem;
            font-weight: 600;
            color: #1a1a2e;
        }}

        /* Intake cards */
        .intake-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 14px;
        }}
        .intake-card {{
            background: linear-gradient(135deg, #fdf8f0, #f9f0e3);
            padding: 20px 16px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e8d5bc;
        }}
        .intake-card .label {{
            font-size: 0.7rem;
            color: #8b6914;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 1px;
        }}
        .intake-card .value {{
            font-size: 1.15rem;
            color: #1a1a2e;
            margin-top: 6px;
            font-weight: 600;
        }}

        /* Lists */
        ul {{
            list-style: none;
            padding: 0;
            margin-top: 10px;
        }}
        ul li {{
            padding: 10px 16px;
            margin-bottom: 6px;
            background: #f8f6f3;
            border-left: 3px solid #d4a373;
            border-radius: 6px;
            line-height: 1.6;
            color: #4a5568;
            font-size: 0.93rem;
        }}
        ol.instructions {{
            padding: 0 0 0 24px;
            margin-top: 10px;
            counter-reset: step-counter;
        }}
        ol.instructions li {{
            padding: 10px 16px;
            margin-bottom: 8px;
            background: #f8f6f3;
            border-left: 3px solid #d4a373;
            border-radius: 6px;
            line-height: 1.6;
            color: #4a5568;
            font-size: 0.93rem;
        }}

        /* Notes */
        .note {{
            background: linear-gradient(135deg, #fdf8f0, #f9f0e3);
            border-left: 4px solid #d4a373;
            padding: 14px 18px;
            border-radius: 8px;
            margin-top: 12px;
            font-size: 0.9rem;
            color: #78350f;
            line-height: 1.6;
        }}

        /* Recipe meta */
        .recipe-desc {{
            margin-bottom: 16px;
        }}
        .recipe-meta {{
            display: flex;
            gap: 16px;
            margin-bottom: 4px;
        }}
        .meta-item {{
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 14px;
            background: #f8f6f3;
            border-radius: 12px;
            border: 1px solid #e8dfd4;
        }}
        .meta-icon {{ font-size: 1.3rem; }}
        .meta-label {{
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            font-weight: 600;
            margin-top: 4px;
        }}
        .meta-value {{
            font-weight: 700;
            color: #1a1a2e;
            font-size: 0.95rem;
            margin-top: 2px;
        }}

        /* Animations */
        .animate-in {{
            opacity: 0;
            transform: translateY(16px);
            animation: fadeInUp 0.5s ease forwards;
        }}
        @keyframes fadeInUp {{
            to {{
                opacity: 1;
                transform: translateY(0);
            }}
        }}

        /* Footer */
        .footer {{
            background: #1a1a2e;
            color: rgba(255,255,255,0.6);
            text-align: center;
            padding: 32px 24px;
            font-size: 0.85rem;
            line-height: 1.7;
        }}
        .footer strong {{
            color: rgba(255,255,255,0.85);
        }}
        .footer .footer-divider {{
            width: 40px;
            height: 2px;
            background: rgba(212,163,115,0.4);
            margin: 10px auto;
            border-radius: 1px;
        }}

        /* Audio player */
        .audio-bar {{
            background: rgba(212,163,115,0.2);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(212,163,115,0.4);
            border-radius: 50px;
            padding: 8px 20px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-top: 16px;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
        }}
        .audio-bar:hover {{
            background: rgba(212,163,115,0.35);
            transform: scale(1.03);
        }}
        .audio-bar .audio-icon {{
            font-size: 1.2rem;
        }}
        .audio-bar .audio-label {{
            font-size: 0.88rem;
            font-weight: 500;
            color: #e6b980;
            letter-spacing: 0.3px;
        }}
        .audio-bar.playing {{
            background: rgba(212,163,115,0.4);
        }}
        .audio-bar.playing .audio-icon {{
            animation: pulse 1s ease-in-out infinite;
        }}
        @keyframes pulse {{
            0%, 100% {{ opacity: 1; }}
            50% {{ opacity: 0.5; }}
        }}

        /* YouTube link */
        .youtube-link {{
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 14px 24px;
            background: #ff0000;
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.95rem;
            transition: background 0.2s, transform 0.15s;
            margin-top: 12px;
        }}
        .youtube-link:hover {{
            background: #cc0000;
            transform: translateY(-2px);
        }}
        .youtube-link .yt-icon {{
            font-size: 1.3rem;
        }}

        /* Responsive */
        @media (max-width: 640px) {{
            .hero {{ padding: 80px 20px 40px; }}
            .hero h1 {{ font-size: 2rem; }}
            .main {{ padding: 0 16px 40px; }}
            .card {{ padding: 24px 20px; }}
            .nutrition-grid {{ grid-template-columns: 1fr 1fr; }}
            .intake-grid {{ grid-template-columns: 1fr; }}
            .recipe-meta {{ flex-direction: column; gap: 10px; }}
        }}
    </style>
</head>
<body>
    <nav class="back-nav">
        <a href="index.html">&#8592; Nourish &amp; Know</a>
    </nav>

    <div class="hero">
        <div class="hero-content">
            {f'<img class="hero-img" src="{image_path}" alt="{name}">' if image_path else ''}
            <h1>{name}</h1>
            <p class="subtitle">Comprehensive Nutrition Profile</p>
            <span class="badge">&#127807; Plant-Based</span>
            <div>
                <div class="audio-bar" id="audioBtn" onclick="toggleAudio()">
                    <span class="audio-icon" id="audioIcon">&#128264;</span>
                    <span class="audio-label" id="audioLabel">Listen to this Content</span>
                </div>
            </div>
        </div>
    </div>

    <div class="main">
        <div class="section card animate-in" style="animation-delay:0.05s">
            <h2>&#128220; History &amp; Origin</h2>
            <p>{data.get('history', 'N/A')}</p>
        </div>

        <div class="section card animate-in" style="animation-delay:0.1s">
            <h2>&#127758; Native Country</h2>
            <p>{data.get('native_country', 'N/A')}</p>
        </div>

        <div class="section card animate-in" style="animation-delay:0.2s">
            <h2>&#129367; Nutrition Profile</h2>
            <p><strong>Serving Size:</strong> {np.get('serving_size', 'N/A')}</p>
            <div class="nutrition-grid">
                <div class="nutrition-item"><strong>Calories</strong><span>{np.get('calories', 'N/A')}</span></div>
                <div class="nutrition-item"><strong>Protein</strong><span>{np.get('protein', 'N/A')}</span></div>
                <div class="nutrition-item"><strong>Fiber</strong><span>{np.get('fiber', 'N/A')}</span></div>
                <div class="nutrition-item"><strong>Fat</strong><span>{np.get('fat', 'N/A')}</span></div>
                <div class="nutrition-item"><strong>Carbs</strong><span>{np.get('carbohydrates', 'N/A')}</span></div>
                <div class="nutrition-item"><strong>Notable</strong><span>{np.get('notable_properties', 'N/A')}</span></div>
            </div>
            <h3>Key Vitamins</h3>
            <ul>{render_list(np.get('key_vitamins', []))}</ul>
            <h3>Key Minerals</h3>
            <ul>{render_list(np.get('key_minerals', []))}</ul>
        </div>

        <div class="section card animate-in" style="animation-delay:0.3s">
            <h2>&#128202; Daily Intake</h2>
            <div class="intake-grid">
                <div class="intake-card">
                    <div class="label">Teaspoons</div>
                    <div class="value">{intake.get('tsp', 'N/A')}</div>
                </div>
                <div class="intake-card">
                    <div class="label">Tablespoons</div>
                    <div class="value">{intake.get('tbsp', 'N/A')}</div>
                </div>
                <div class="intake-card">
                    <div class="label">Cup</div>
                    <div class="value">{intake.get('cup', 'N/A')}</div>
                </div>
            </div>
            {"<div class='note'><strong>&#9888; Upper limit:</strong> " + intake.get('upper_limit', '') + "</div>" if intake.get('upper_limit') else ""}
            {"<div class='note'>" + intake.get('note', '') + "</div>" if intake.get('note') else ""}
        </div>

        <div class="section card animate-in" style="animation-delay:0.4s">
            <h2>&#9200; Best Time to Eat</h2>
            <p>{data.get('best_time_to_eat', 'N/A')}</p>
        </div>

        <div class="section card animate-in" style="animation-delay:0.5s">
            <h2>&#127869; Meal Incorporation</h2>
            <p><strong>Can be added to meals:</strong> {'Yes' if meals.get('can_be_added', True) else 'No'}</p>
            <ul>{render_list(suggestions)}</ul>
            {"<h3>Additional Notes</h3><div class=" + '"note"' + ">" + "<ul>" + render_list(meals.get('additional_notes', [])) + "</ul></div>" if meals.get('additional_notes') else ""}
        </div>

        {recipe_html}

        <div class="section card animate-in" style="animation-delay:0.7s">
            <h2>&#127909; Learn More</h2>
            <p>Watch videos about {name} — its history, how it's grown, and nutritional benefits.</p>
            <a class="youtube-link" href="https://www.youtube.com/results?search_query={name.replace(' ', '+')}+nutrition+benefits+health" target="_blank" rel="noopener">
                <span class="yt-icon">&#9654;</span>
                Search "{name}" on YouTube
            </a>
        </div>
    </div>

    <footer class="footer">
        <strong>Nourish &amp; Know</strong> &#8212; Mostly Plant-Based Nutrition Guide
        <div class="footer-divider"></div>
        <span style="font-size:0.85rem; opacity:0.9; font-weight:600;">* AI-generated content and auto-validated. Use at your own discretion.</span>
    </footer>

    <script>
    let speaking = false;
    let utterance = null;

    function getPageText() {{
        const sections = document.querySelectorAll('.section p, .section li, .nutrition-item');
        let text = '{name}. Comprehensive Nutrition Profile. ';
        sections.forEach(el => {{
            text += el.textContent.trim() + '. ';
        }});
        return text;
    }}

    function toggleAudio() {{
        const btn = document.getElementById('audioBtn');
        const icon = document.getElementById('audioIcon');
        const label = document.getElementById('audioLabel');

        if (speaking) {{
            window.speechSynthesis.cancel();
            speaking = false;
            btn.classList.remove('playing');
            icon.innerHTML = '&#128264;';
            label.textContent = 'Listen to this Content';
        }} else {{
            utterance = new SpeechSynthesisUtterance(getPageText());
            utterance.rate = 0.95;
            utterance.pitch = 1;
            utterance.onend = function() {{
                speaking = false;
                btn.classList.remove('playing');
                icon.innerHTML = '&#128264;';
                label.textContent = 'Listen to this Content';
            }};
            window.speechSynthesis.speak(utterance);
            speaking = true;
            btn.classList.add('playing');
            icon.innerHTML = '&#9209;';
            label.textContent = 'Stop listening';
        }}
    }}
    </script>
</body>
</html>"""
    return html


# ---------------------------------------------------------------------------
# Email sender
# ---------------------------------------------------------------------------

def send_email(html_content, food_name, keys):
    """Send the HTML nutrition profile via Gmail SMTP."""
    email_cfg = keys.get("email")
    if not email_cfg:
        print("No email config found in keys.txt. Skipping email.")
        return

    sender = email_cfg["sender_email"]
    password = email_cfg["app_password"]
    recipients = email_cfg["recipients"]
    smtp_server = email_cfg["smtp_server"]
    smtp_port = email_cfg["smtp_port"]

    if sender == "YOUR_GMAIL@gmail.com" or password == "YOUR_APP_PASSWORD":
        print("Email not configured. Update sender_email and app_password in keys.txt.")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{food_name} - Nutrition Profile"
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)

    # Plain text fallback
    plain_text = f"Please view this email in an HTML-capable client to see the {food_name} nutrition profile."
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    print(f"Sending email to {', '.join(recipients)}...")
    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, recipients, msg.as_string())
    print("Email sent successfully!")


# ---------------------------------------------------------------------------
# Main

def main():
    if len(sys.argv) > 1:
        food_item = " ".join(sys.argv[1:])
    else:
        food_item = input("Enter a food item (e.g., hemp seeds): ").strip()

    if not food_item:
        print("No food item provided. Exiting.")
        sys.exit(1)

    keys, system_prompt, profile, output_format = load_config()

    # Step 1: Query LLM
    data = query_llm(food_item, keys, system_prompt, profile, output_format)
    print(f"Received nutrition data for '{data.get('name', food_item)}'")

    # Step 2: Validate
    is_valid, issues = validate_data(data, food_item, keys)
    if is_valid:
        print("VALIDATION PASSED: All checks passed.")
    else:
        print(f"VALIDATION WARNINGS ({len(issues)}):")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        print("Proceeding with corrected data...")

    # Step 3: Generate HTML
    html = generate_html(data)

    # Step 4: Save
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filename = food_item.lower().replace(" ", "_") + ".html"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w") as f:
        f.write(html)
    print(f"HTML saved to: {filepath}")

    # Step 5: Email
    send_email(html, data.get("name", food_item), keys)


if __name__ == "__main__":
    main()
