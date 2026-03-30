#!/usr/bin/env python3
"""Import visited countries list into Firestore visited_countries collection."""
import requests, time
from datetime import datetime, timezone

PROJECT = "nutrition-198dd"
URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/visited_countries"
added = errors = 0

def add(country, region):
    global added, errors
    doc = {"fields": {
        "country": {"stringValue": country},
        "region":  {"stringValue": region},
        "addedAt": {"stringValue": datetime.now(timezone.utc).isoformat()}
    }}
    r = requests.post(URL, json=doc)
    if r.status_code == 200:
        added += 1
        print(f"  ✓ {region} — {country}")
    else:
        errors += 1
        print(f"  ✗ {country}: {r.text[:80]}")
    time.sleep(0.04)

VISITED = [
    # North America
    ("Canada",             "North America"),
    ("USA",                "North America"),
    ("Mexico",             "North America"),
    ("Guatemala",          "North America"),
    ("Belize",             "North America"),
    ("El Salvador",        "North America"),
    ("Honduras",           "North America"),
    ("Costa Rica",         "North America"),
    ("Nicaragua",          "North America"),
    ("Panama",             "North America"),
    # Caribbean
    ("Cuba",               "Caribbean"),
    ("Jamaica",            "Caribbean"),
    ("Bahamas",            "Caribbean"),
    ("St. Lucia",          "Caribbean"),
    ("Dominican Republic", "Caribbean"),
    # South America
    ("Colombia",           "South America"),
    ("Ecuador",            "South America"),
    ("Brazil",             "South America"),
    ("Peru",               "South America"),
    ("Chile",              "South America"),
    ("Bolivia",            "South America"),
    ("Uruguay",            "South America"),
    ("Argentina",          "South America"),
    # Europe
    ("United Kingdom",     "Europe"),
    ("France",             "Europe"),
    ("Denmark",            "Europe"),
    ("Sweden",             "Europe"),
    ("Russia",             "Europe"),
    ("Germany",            "Europe"),
    ("Switzerland",        "Europe"),
    ("Italy",              "Europe"),
    ("Vatican City",       "Europe"),
    ("Spain",              "Europe"),
    ("Portugal",           "Europe"),
    ("Austria",            "Europe"),
    ("Greece",             "Europe"),
    ("Albania",            "Europe"),
    ("Montenegro",         "Europe"),
    ("Kosovo",             "Europe"),
    ("Czechia",            "Europe"),
    ("Slovakia",           "Europe"),
    ("Netherlands",        "Europe"),
    ("Belgium",            "Europe"),
    ("Iceland",            "Europe"),
    # Asia & Pacific
    ("Australia",          "Asia & Pacific"),
    ("New Zealand",        "Asia & Pacific"),
    ("Indonesia",          "Asia & Pacific"),
    ("Thailand",           "Asia & Pacific"),
    ("Malaysia",           "Asia & Pacific"),
    ("Singapore",          "Asia & Pacific"),
    ("Vietnam",            "Asia & Pacific"),
    ("Myanmar",            "Asia & Pacific"),
    ("India",              "Asia & Pacific"),
    ("Sri Lanka",          "Asia & Pacific"),
    ("Philippines",        "Asia & Pacific"),
    ("Georgia",            "Asia & Pacific"),
    ("Turkey",             "Asia & Pacific"),
    ("China",              "Asia & Pacific"),
    ("Japan",              "Asia & Pacific"),
    ("Taiwan",             "Asia & Pacific"),
    ("Laos",               "Asia & Pacific"),
    ("Cambodia",           "Asia & Pacific"),
    ("South Korea",        "Asia & Pacific"),
    # Middle East
    ("UAE",                "Middle East"),
    ("Qatar",              "Middle East"),
    ("Syria",              "Middle East"),
    ("Lebanon",            "Middle East"),
    ("Jordan",             "Middle East"),
    ("Israel",             "Middle East"),
    # Africa
    ("Morocco",            "Africa"),
    ("Tanzania",           "Africa"),
    ("South Africa",       "Africa"),
    ("Namibia",            "Africa"),
    ("Botswana",           "Africa"),
    ("Zambia",             "Africa"),
    ("Zimbabwe",           "Africa"),
]

if __name__ == "__main__":
    print(f"Importing {len(VISITED)} visited countries...\n")
    for country, region in VISITED:
        add(country, region)
    print(f"\nDone. {added} added, {errors} errors.")
