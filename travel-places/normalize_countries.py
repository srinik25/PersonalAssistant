#!/usr/bin/env python3
"""Normalize country names in travel_places (e.g. 'brazil' → 'Brazil')."""
import requests, time

PROJECT = "nutrition-198dd"
BASE    = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"

SPECIAL = {
    'usa': 'USA', 'uae': 'UAE', 'uk': 'United Kingdom',
    'ussr': 'Russia', 'dc': 'District of Columbia',
}
LOWERCASE_WORDS = {'and', 'of', 'the', 'de', 'del', 'la', 'el', 'von', 'van'}

def normalize(s):
    if not s: return s
    sl = s.strip().lower()
    if sl in SPECIAL: return SPECIAL[sl]
    words = s.strip().split()
    out = []
    for i, w in enumerate(words):
        out.append(w.capitalize() if (i == 0 or w.lower() not in LOWERCASE_WORDS) else w.lower())
    return ' '.join(out)

updated = errors = checked = 0
page_token = None

while True:
    params = {'pageSize': 300}
    if page_token: params['pageToken'] = page_token
    r = requests.get(f"{BASE}/travel_places", params=params)
    data = r.json()

    for doc in data.get('documents', []):
        checked += 1
        fields  = doc.get('fields', {})
        country = fields.get('country', {}).get('stringValue', '')
        norm    = normalize(country)
        if country and country != norm:
            patch_url = f"https://firestore.googleapis.com/v1/{doc['name']}?updateMask.fieldPaths=country"
            pr = requests.patch(patch_url, json={"fields": {"country": {"stringValue": norm}}})
            if pr.status_code == 200:
                updated += 1
                print(f"  ✓ '{country}' → '{norm}'")
            else:
                errors += 1
                print(f"  ✗ '{country}': {pr.text[:80]}")
            time.sleep(0.05)

    page_token = data.get('nextPageToken')
    if not page_token: break

print(f"\nChecked {checked} docs — {updated} updated, {errors} errors.")
