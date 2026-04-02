# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A multi-app personal productivity suite for Srini Katta. Six apps sharing a single Firebase project (`nutrition-198dd`).

| App | Purpose | Deployed To |
|-----|---------|-------------|
| `meal-planner/` | AI weekly meal planning + nutrition review | https://placid-yacht-e8e4.here.now/ |
| `finance-tracker/` | Portfolio tracking + AI analysis | localhost:8080 (local only) |
| `health-tracker/` | Health records across 11 categories | localhost:8081 (local only) |
| `travel-site/` | Travel inspiration + inquiry form | https://golden-halo-8f6k.here.now/ |
| `site/` | Event/food curation for DC Metro area | https://stellar-orbit-dhwf.here.now/ |
| `reading-links/` | Personal reading list with Science/Human Stories/Other tabs | https://silver-essence-gpqt.here.now/ |
| `travel-places/` | Travel bucket list — continents → countries → cities → food/places | https://jovial-bugle-zkby.here.now/ |
| `todo-site/` | Task manager — year → month → week hierarchy with types & backlog | https://witty-kayak-7n57.here.now/ |
| `musings/` | Personal quotes, systems & guidelines | https://still-lagoon-tsp3.here.now/ |
| `fitness-tracker/` | Cardiac-safe fitness plan: knee rehab, shoulder, Zone 2 cardio | https://spicy-lichen-9qbh.here.now/ |
| `nutrition/` | Daily Python-generated nutrition profiles | Published daily via cron |
| `home/` | AD+SK homepage — links to all apps | https://centered-nirvana-wryg.here.now/ |

## Deploying

**Static apps (meal-planner, travel-site, site) — always redeploy after changes:**
```bash
# Meal planner (exclude functions/node_modules; secrets.js MUST be included)
rm -rf /tmp/mp-deploy && mkdir /tmp/mp-deploy
cp meal-planner/*.html /tmp/mp-deploy/ && cp -r meal-planner/js /tmp/mp-deploy/ && cp secrets.js /tmp/mp-deploy/
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh /tmp/mp-deploy --slug placid-yacht-e8e4

# Travel site
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh travel-site --slug golden-halo-8f6k

# Site (What's Happening)
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh site --slug stellar-orbit-dhwf

# Reading List (secrets.js must be included)
rm -rf /tmp/rl-deploy && mkdir /tmp/rl-deploy
cp reading-links/index.html /tmp/rl-deploy/ && cp -r reading-links/js /tmp/rl-deploy/ && cp secrets.js /tmp/rl-deploy/
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh /tmp/rl-deploy --slug silver-essence-gpqt

# Travel Places (Firebase config inlined — no secrets.js needed)
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh travel-places --slug jovial-bugle-zkby

# Todo Site (Firebase config inlined — no secrets.js needed)
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh todo-site --slug witty-kayak-7n57

# Musings (Firebase config inlined — no secrets.js needed)
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh musings --slug still-lagoon-tsp3

# Fitness Tracker (Firebase config inlined — no secrets.js needed)
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh fitness-tracker --slug spicy-lichen-9qbh

# Home page (AD+SK — links to all apps)
HERENOW_API_KEY=$(cat ~/.herenow/credentials) bash ~/.claude/skills/here-now/scripts/publish.sh home --slug centered-nirvana-wryg
```

**Firebase Cloud Functions (meal-planner/functions/):**
```bash
cd meal-planner && firebase deploy --only functions
```

**Local apps — open via browser after starting server:**
```bash
# Finance tracker
cd finance-tracker && python3 -m http.server 8080

# Health tracker
cd health-tracker && python3 -m http.server 8081
```
Or double-click the `.command` file in each folder.

## API Keys & Secrets

- `/secrets.js` (git-ignored) — OpenAI API key used by meal-planner, loaded as `OPENAI_API_KEY`
- `finance-tracker/js/secrets.js` and `health-tracker/js/secrets.js` — local OpenAI keys
- `nutrition/config/keys.txt` — OpenAI key for Python scripts
- Firebase secrets (meal-planner Cloud Functions): `GMAIL_EMAIL`, `GMAIL_APP_PASSWORD`, `NOTIFY_EMAIL`
- here.now API key: `~/.herenow/credentials`

## Architecture

### Shared Firebase Backend
All apps use Firebase project `nutrition-198dd`. Firestore is the only database — no SQL, no REST backend. Client-side JS talks directly to Firestore via the Firebase compat SDK.

### Auth Pattern
Every web app has `js/auth.js` with the same pattern: `firebase.auth().onAuthStateChanged()` sets a `currentUser` global and flushes an `onAuthReady()` callback queue. Meal-planner requires auth (redirects to `login.html`). Finance/health trackers are local-only with open Firestore rules.

### LLM Integration
All AI calls go to OpenAI (`gpt-4o-mini` for interactive, `gpt-4o` for batch/cron). Pattern:
- Load API key from `secrets.js` or config file
- Build system + user prompt
- Call `https://api.openai.com/v1/chat/completions`
- For interactive UI: use `stream: true` with `response.body.getReader()` to stream tokens into the DOM
- Meal-planner tracks token usage to Firestore (`token_usage` collection) via `trackTokenUsage()`

### PII Protection
Finance and health trackers strip/mask identifying info before sending to LLM. `pii.js` in each app handles this. Never send raw account names or patient-identifying data to OpenAI.

### No Build Tools
HTML/CSS/JS only — no webpack, no bundler, no TypeScript. Edit files directly. The only `package.json` is in `meal-planner/functions/` for Cloud Functions.

### here.now Deploys
The meal-planner `functions/` folder contains ~5600 files (node_modules). Always copy only static files to a temp dir before deploying to here.now to avoid the curl argument limit.

## Firestore Collections

```
meal_plans, user_profiles, token_usage, contact_messages  ← auth-scoped
finance_accounts, finance_profiles, finance_snapshots, finance_analyses  ← open (local only)
health_entries, health_profiles, health_analyses  ← open (local only)
travel_inquiries, whatshappening_items  ← open create
```

## site/ (What's Happening)

- `data/items.json` is the source of truth (683+ curated items)
- Items have `type`: `event | read | food | headsup`
- `scripts/weekly_update.py` runs via cron to add new items
- `openclaw-agent-prompt.md` documents the weekly automation spec
- User profile context in `srini-profile.json` (interests, location: Loudoun/Montgomery County)

## nutrition/ (Daily Cron)

```bash
cd nutrition && python3 daily_run.py
```
Iterates through 32 foods in `config/daily_tracker.json`, generates HTML, publishes to here.now, sends SMS via email gateway.
