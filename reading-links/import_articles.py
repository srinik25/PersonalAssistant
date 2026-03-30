#!/usr/bin/env python3
"""
Import articles from PDF into reading_links Firestore collection.
Classifies via OpenAI, writes via Firestore REST API.
Usage: python3 import_articles.py [--batch N] [--start N]
"""
import json, sys, re, argparse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import urlopen, Request
from urllib.error import URLError
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────

PROJECT_ID = "nutrition-198dd"
FIREBASE_KEY = "AIzaSyDovFuXnRsL8Drf0EMkUrHqwNE-DDhMvXM"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/reading_links?key={FIREBASE_KEY}"

# Load OpenAI key from secrets.js
SECRETS = Path(__file__).parent.parent / "secrets.js"
OPENAI_KEY = ""
if SECRETS.exists():
    m = re.search(r'OPENAI_API_KEY\s*=\s*["\']([^"\']+)["\']', SECRETS.read_text())
    if m:
        OPENAI_KEY = m.group(1)

# ── All URLs from articles.pdf ──────────────────────────────────────────────

ALL_URLS = [
    # Page 1
    "https://www.theatlantic.com/science/archive/2022/12/how-the-human-brain-is-wired-for-beauty/672291/",
    "https://www.theguardian.com/science/2023/feb/18/100-centenarians-100-tips-for-a-life-well-lived",
    "https://www.theringer.com/2022/3/3/22956353/fatherhood-cancer-jonathan-tjarks",
    "https://ig.ft.com/taiwan-economy/",
    "https://www.theverge.com/features/23764584/ai-artificial-intelligence-data-notation-labor-scale-surge-remotasks-openai-chatbots",
    "https://www.theatlantic.com/culture/archive/2023/08/career-retirement-transition-academic-programs/675085/",
    "https://www.nytimes.com/interactive/2023/08/12/climate/clean-energy-us-fossil-fuels.html",
    "https://www.economist.com/science-and-technology/2023/08/23/superbatteries-will-transform-the-performance-of-evs",
    "https://www.washingtonpost.com/lifestyle/2024/04/07/amy-ettinger-death-dan-white/",
    "https://archive.ph/38Lq1",
    # Page 2
    "https://www.washingtonpost.com/technology/2020/04/06/your-internet-is-working-thank-these-cold-war-era-pioneers-who-designed-it-handle-almost-anything/",
    "https://www.newyorker.com/magazine/2023/08/21/the-hidden-cost-of-free-returns",
    "https://fivebooks.com/best-books/massimo-pigliucci-stoicism/",
    "https://www.wsj.com/amp/articles/when-will-i-retire-e3750715",
    "https://www.newyorker.com/magazine/2023/02/13/the-astonishing-transformation-of-austin",
    "https://www.ft.com/content/5631cc22-a04d-405c-9154-e307f938f8f3",
    "https://www.safalniveshak.com/20-ideas-that-changed-my-life/",
    "https://www.newyorker.com/magazine/2023/01/16/how-should-we-think-about-our-different-styles-of-thinking",
    "https://www.privatdozent.co/p/godels-solution-to-einsteins-field",
    "https://mathshistory.st-andrews.ac.uk/Extras/Keynes_Newton/",
    "https://www.ft.com/content/03895dc4-a3b7-481e-95cc-336a524f2ac2",
    "https://www.newyorker.com/science/elements/how-food-powers-your-body-metabolism-calorie",
    "https://www.nytimes.com/2023/06/08/magazine/merlin-sheldrake-fungi.html",
    "https://www.nytimes.com/interactive/2023/11/05/magazine/james-webb-space-telescope.html",
    "https://ig.ft.com/microchips/",
    "https://ig.ft.com/subsea-cables/",
    "https://www.noemamag.com/what-ai-teaches-us-about-good-writing/",
    "https://www.nytimes.com/2023/05/25/technology/ai-chatbot-chatgpt-prompts.html",
    "https://www.nytimes.com/2023/06/03/science/bird-flight-evolution.html",
    "https://www.wsj.com/amp/articles/chatgpt-heralds-an-intellectual-revolution-enlightenment-artificial-intelligence-homo-technicus-technology-cognition-morality-philosophy-774331c6",
    "https://www.npr.org/sections/money/2022/09/06/1120583353/money-management-budgeting-tips",
    "https://www.washingtonpost.com/wellness/2023/01/04/exercise-snacks-workout-breaks/",
    "https://www.nytimes.com/2023/06/16/opinion/cancer-treatment-disparities.html",
    "https://www.nytimes.com/2022/11/23/magazine/quiet-chamber-minneapolis.html",
    "https://www.newyorker.com/science/annals-of-artificial-intelligence/how-will-ai-learn-next",
    "https://nautil.us/how-life-really-works-435813/",
    "https://www.wsj.com/amp/articles/chips-semiconductors-manufacturing-china-taiwan-11673650917",
    "https://time.com/6249784/quantum-computing-revolution/",
    # Page 3
    "https://medium.com/@pravse/the-maze-is-in-the-mouse-980c57cfd61a",
    "https://nautil.us/the-universal-clock-of-aging-259337/",
    "https://www.theguardian.com/society/2021/jul/11/unlocking-the-gut-microbiome-and-its-massive-significance-to-our-health",
    "https://www.theatlantic.com/science/archive/2023/01/unique-nostalgia-space/672639/",
    "https://www.wired.com/2017/02/life-death-spring-disorder/",
    "https://www.newyorker.com/magazine/2017/02/13/when-things-go-missing",
    "https://www.thecut.com/2017/01/to-change-your-life-learn-how-to-trust-your-future-self.html",
    "https://www.nytimes.com/2005/09/25/magazine/after-life.html",
    "https://www.technologyreview.com/2024/03/04/1089403/large-language-models-amazing-but-nobody-knows-why/",
    "https://www.neh.gov/humanities/2011/januaryfebruary/feature/newton-the-last-magician",
    "https://www.wsj.com/health/wellness/is-that-food-ultra-processed-how-to-tell-5bf8db05",
    "https://www.outsideonline.com/food/heart-dark-chocolate/",
    "https://www.newyorker.com/magazine/2005/04/04/piecework",
    "https://www.vqronline.org/essays-articles/2016/03/cost-living",
    "https://www.theatlantic.com/health/archive/2013/07/the-vitamin-myth-why-we-think-we-need-supplements/277947/",
    "https://www.newyorker.com/magazine/2010/08/02/letting-go-2",
    "https://www.quantamagazine.org/how-the-physics-of-nothing-underlies-everything-20220809/",
    "https://www.newyorker.com/magazine/2023/01/30/what-monks-can-teach-us-about-paying-attention-wandering-mind-jamie-kreiner",
    "https://www.nature.com/articles/d41586-019-00285-9",
    "https://www.wired.com/2014/09/curvature-and-strength-empzeal/",
    "https://nautil.us/how-we-remember-last-weekend-240328/",
    "https://www.cnet.com/home/internet/features/the-secret-life-of-the-500-cables-that-run-the-internet/",
    "https://www.newyorker.com/science/annals-of-artificial-intelligence/how-to-picture-ai",
    "https://www.newyorker.com/magazine/2024/03/04/what-a-major-solar-storm-could-do-to-our-planet",
    "https://www.reuters.com/investigates/special-report/us-china-tech-quantum/",
    "https://www.bbc.com/future/article/20231115-how-did-time-begin-and-how-will-it-end",
    "https://www.newyorker.com/culture/annals-of-inquiry/the-man-who-invented-fifteen-hundred-necktie-knots",
    # Page 4
    "https://www.nytimes.com/2022/10/10/science/black-holes-cosmology-hologram.html",
    "https://www.newyorker.com/magazine/2022/12/19/the-world-changing-race-to-develop-the-quantum-computer",
    "https://www.nytimes.com/2020/05/06/magazine/val-kilmer.html",
    "https://www.newyorker.com/science/elements/the-fossil-flowers-that-rewrote-the-history-of-life",
    "https://www.newyorker.com/science/elements/how-safe-are-nuclear-power-plants",
    "https://sciencenordic.com/denmark-epidemic-health/how-your-immune-system-combats-infections-like-covid-19/1739725",
    "https://www.wsj.com/articles/the-battery-is-ready-to-power-the-world-11612551578",
    "https://harpers.org/archive/2023/09/man-called-fran/",
    "https://www.theatlantic.com/science/archive/2021/02/to-infinity-and-beyond/617965/",
    "https://www.ft.com/content/6cb781f8-f49d-4a14-875d-a2490e46b1cd",
    "https://www.theatlantic.com/science/archive/2021/02/phosphorus-pollution-fertilizer/617937/",
    "https://nautil.us/the-remarkable-emptiness-of-existence-256323/",
    "https://www.nytimes.com/2021/02/26/opinion/sunday/coronavirus-alive-dead.html",
    "https://www.nytimes.com/2020/12/08/travel/dakar-senegal-vacation-at-home.html",
    "https://www.wsj.com/articles/when-spac-man-chamath-palihapitiya-speaks-reddit-and-wall-street-listen-11615006818",
    "https://www.wsj.com/articles/americas-battery-powered-car-hopes-ride-on-lithium-one-producer-paves-the-way-11615311932",
    "https://www.quantamagazine.org/pioneering-quantum-physicists-win-nobel-prize-in-physics-20221004/",
    # Page 5
    "https://www.bloomberg.com/features/2022-the-crypto-story/",
    "https://www.wsj.com/articles/the-best-of-berlin-via-films-food-music-and-naturally-beer-11615375663",
    "https://www.ft.com/content/8c166aa4-9fd6-4246-8969-9eee332f9043",
    "https://www.newyorker.com/magazine/2011/04/25/the-possibilian",
    "https://nautil.us/that-is-not-how-your-brain-works-238138/",
    "https://www.scientificamerican.com/article/inside-the-1-5-trillion-nuclear-weapons-program-youve-never-heard-of/",
    "https://www.theguardian.com/lifeandstyle/2024/feb/05/phone-screentime-detox-reflection",
    "https://www.economist.com/1843/2021/03/10/banker-princess-warlord-the-many-lives-of-asma-assad",
    "https://www.washingtonpost.com/sports/2021/03/17/conrad-anker-everest-climber/",
    "https://www.perceptivetravel.com/issues/1218/kelly.html",
    "https://hbr.org/podcast/2021/03/the-architects-of-ai",
    "https://www.nytimes.com/2007/07/10/science/10angi.html",
    "https://www.lrb.co.uk/the-paper/v43/n06/thomas-meaney/the-bayswater-grocer",
    "https://www.ft.com/content/eca7988d-2961-4b27-9368-ff58c966e969",
    "https://tetw.org/Science_and_Technology",
    "https://www.wsj.com/articles/tony-hsieh-zappos-death-entourage-11616761915",
    "https://www.theatlantic.com/magazine/archive/2023/04/subjective-age-how-old-you-feel-difference/673086/",
    "https://harpers.org/archive/2023/04/the-science-of-the-perfect-second/",
    "https://www.experimental-history.com/p/why-arent-smart-people-happier",
    "https://knowablemagazine.org/article/living-world/2023/how-endomembrane-system-of-eukaryotic-cells-evolved",
    "https://www.quantamagazine.org/in-our-cellular-clocks-shes-found-a-lifetime-of-discoveries-20231010/",
    "https://www.wsj.com/articles/graphene-and-beyond-the-wonder-materials-that-could-replace-silicon-in-future-tech-11616817603",
    "https://www.theatlantic.com/culture/archive/2021/03/pharmako-ai-possibilities-machine-creativity/618435/",
    "https://www.economist.com/briefing/2021/03/27/covid-19-vaccines-have-alerted-the-world-to-the-power-of-rna-therapies",
]

# ── Classify via OpenAI ─────────────────────────────────────────────────────

VALID_CATEGORIES = {
    "physics_cosmos", "biology_life", "technology", "artificial_intelligence",
    "human_stories", "health_wellness", "philosophy", "economics_society"
}

# Pre-assigned categories from analysis (overrides OpenAI for known URLs)
URL_CATEGORIES = {
    "https://www.theatlantic.com/science/archive/2022/12/how-the-human-brain-is-wired-for-beauty/672291/": "biology_life",
    "https://www.nytimes.com/interactive/2023/08/12/climate/clean-energy-us-fossil-fuels.html": "physics_cosmos",
    "https://www.economist.com/science-and-technology/2023/08/23/superbatteries-will-transform-the-performance-of-evs": "technology",
    "https://www.washingtonpost.com/technology/2020/04/06/your-internet-is-working-thank-these-cold-war-era-pioneers-who-designed-it-handle-almost-anything/": "technology",
    "https://www.privatdozent.co/p/godels-solution-to-einsteins-field": "physics_cosmos",
    "https://mathshistory.st-andrews.ac.uk/Extras/Keynes_Newton/": "physics_cosmos",
    "https://www.nytimes.com/2023/06/08/magazine/merlin-sheldrake-fungi.html": "biology_life",
    "https://www.nytimes.com/interactive/2023/11/05/magazine/james-webb-space-telescope.html": "physics_cosmos",
    "https://ig.ft.com/microchips/": "technology",
    "https://ig.ft.com/subsea-cables/": "technology",
    "https://www.nytimes.com/2023/06/03/science/bird-flight-evolution.html": "biology_life",
    "https://www.nytimes.com/2022/11/23/magazine/quiet-chamber-minneapolis.html": "physics_cosmos",
    "https://nautil.us/how-life-really-works-435813/": "biology_life",
    "https://www.wsj.com/amp/articles/chips-semiconductors-manufacturing-china-taiwan-11673650917": "technology",
    "https://time.com/6249784/quantum-computing-revolution/": "technology",
    "https://nautil.us/the-universal-clock-of-aging-259337/": "biology_life",
    "https://www.theatlantic.com/science/archive/2023/01/unique-nostalgia-space/672639/": "physics_cosmos",
    "https://www.neh.gov/humanities/2011/januaryfebruary/feature/newton-the-last-magician": "physics_cosmos",
    "https://www.quantamagazine.org/how-the-physics-of-nothing-underlies-everything-20220809/": "physics_cosmos",
    "https://www.nature.com/articles/d41586-019-00285-9": "biology_life",
    "https://www.wired.com/2014/09/curvature-and-strength-empzeal/": "physics_cosmos",
    "https://www.cnet.com/home/internet/features/the-secret-life-of-the-500-cables-that-run-the-internet/": "technology",
    "https://www.newyorker.com/magazine/2024/03/04/what-a-major-solar-storm-could-do-to-our-planet": "physics_cosmos",
    "https://www.reuters.com/investigates/special-report/us-china-tech-quantum/": "technology",
    "https://www.bbc.com/future/article/20231115-how-did-time-begin-and-how-will-it-end": "physics_cosmos",
    "https://www.nytimes.com/2022/10/10/science/black-holes-cosmology-hologram.html": "physics_cosmos",
    "https://www.newyorker.com/magazine/2022/12/19/the-world-changing-race-to-develop-the-quantum-computer": "technology",
    "https://www.newyorker.com/science/elements/the-fossil-flowers-that-rewrote-the-history-of-life": "biology_life",
    "https://www.newyorker.com/science/elements/how-safe-are-nuclear-power-plants": "physics_cosmos",
    "https://www.wsj.com/articles/the-battery-is-ready-to-power-the-world-11612551578": "technology",
    "https://www.theatlantic.com/science/archive/2021/02/to-infinity-and-beyond/617965/": "physics_cosmos",
    "https://www.theatlantic.com/science/archive/2021/02/phosphorus-pollution-fertilizer/617937/": "biology_life",
    "https://www.nytimes.com/2021/02/26/opinion/sunday/coronavirus-alive-dead.html": "biology_life",
    "https://www.wsj.com/articles/americas-battery-powered-car-hopes-ride-on-lithium-one-producer-paves-the-way-11615311932": "technology",
    "https://www.quantamagazine.org/pioneering-quantum-physicists-win-nobel-prize-in-physics-20221004/": "physics_cosmos",
    "https://www.scientificamerican.com/article/inside-the-1-5-trillion-nuclear-weapons-program-youve-never-heard-of/": "physics_cosmos",
    "https://www.nytimes.com/2007/07/10/science/10angi.html": "biology_life",
    "https://tetw.org/Science_and_Technology": "technology",
    "https://harpers.org/archive/2023/04/the-science-of-the-perfect-second/": "physics_cosmos",
    "https://knowablemagazine.org/article/living-world/2023/how-endomembrane-system-of-eukaryotic-cells-evolved": "biology_life",
    "https://www.quantamagazine.org/in-our-cellular-clocks-shes-found-a-lifetime-of-discoveries-20231010/": "biology_life",
    "https://www.wsj.com/articles/graphene-and-beyond-the-wonder-materials-that-could-replace-silicon-in-future-tech-11616817603": "technology",
    "https://www.economist.com/briefing/2021/03/27/covid-19-vaccines-have-alerted-the-world-to-the-power-of-rna-therapies": "biology_life",
    # AI
    "https://www.noemamag.com/what-ai-teaches-us-about-good-writing/": "artificial_intelligence",
    "https://www.nytimes.com/2023/05/25/technology/ai-chatbot-chatgpt-prompts.html": "artificial_intelligence",
    "https://www.newyorker.com/science/annals-of-artificial-intelligence/how-will-ai-learn-next": "artificial_intelligence",
    "https://www.wsj.com/amp/articles/chatgpt-heralds-an-intellectual-revolution-enlightenment-artificial-intelligence-homo-technicus-technology-cognition-morality-philosophy-774331c6": "artificial_intelligence",
    "https://www.technologyreview.com/2024/03/04/1089403/large-language-models-amazing-but-nobody-knows-why/": "artificial_intelligence",
    "https://www.newyorker.com/science/annals-of-artificial-intelligence/how-to-picture-ai": "artificial_intelligence",
    "https://medium.com/@pravse/the-maze-is-in-the-mouse-980c57cfd61a": "artificial_intelligence",
    "https://hbr.org/podcast/2021/03/the-architects-of-ai": "artificial_intelligence",
    "https://www.theatlantic.com/culture/archive/2021/03/pharmako-ai-possibilities-machine-creativity/618435/": "artificial_intelligence",
    # Human stories
    "https://www.theguardian.com/science/2023/feb/18/100-centenarians-100-tips-for-a-life-well-lived": "human_stories",
    "https://www.theringer.com/2022/3/3/22956353/fatherhood-cancer-jonathan-tjarks": "human_stories",
    "https://www.washingtonpost.com/lifestyle/2024/04/07/amy-ettinger-death-dan-white/": "human_stories",
    "https://archive.ph/38Lq1": "human_stories",
    "https://www.newyorker.com/magazine/2017/02/13/when-things-go-missing": "human_stories",
    "https://www.thecut.com/2017/01/to-change-your-life-learn-how-to-trust-your-future-self.html": "human_stories",
    "https://www.nytimes.com/2005/09/25/magazine/after-life.html": "human_stories",
    "https://www.newyorker.com/magazine/2005/04/04/piecework": "human_stories",
    "https://www.vqronline.org/essays-articles/2016/03/cost-living": "human_stories",
    "https://www.newyorker.com/magazine/2010/08/02/letting-go-2": "human_stories",
    "https://www.newyorker.com/magazine/2023/01/30/what-monks-can-teach-us-about-paying-attention-wandering-mind-jamie-kreiner": "human_stories",
    "https://nautil.us/how-we-remember-last-weekend-240328/": "human_stories",
    "https://www.newyorker.com/culture/annals-of-inquiry/the-man-who-invented-fifteen-hundred-necktie-knots": "human_stories",
    "https://www.nytimes.com/2020/05/06/magazine/val-kilmer.html": "human_stories",
    "https://harpers.org/archive/2023/09/man-called-fran/": "human_stories",
    "https://www.wired.com/2017/02/life-death-spring-disorder/": "human_stories",
    "https://www.newyorker.com/magazine/2023/01/16/how-should-we-think-about-our-different-styles-of-thinking": "human_stories",
    "https://www.wsj.com/articles/tony-hsieh-zappos-death-entourage-11616761915": "human_stories",
    "https://www.theatlantic.com/magazine/archive/2023/04/subjective-age-how-old-you-feel-difference/673086/": "human_stories",
    "https://www.experimental-history.com/p/why-arent-smart-people-happier": "human_stories",
    "https://www.economist.com/1843/2021/03/10/banker-princess-warlord-the-many-lives-of-asma-assad": "human_stories",
    "https://www.washingtonpost.com/sports/2021/03/17/conrad-anker-everest-climber/": "human_stories",
    # Health
    "https://www.washingtonpost.com/wellness/2023/01/04/exercise-snacks-workout-breaks/": "health_wellness",
    "https://www.nytimes.com/2023/06/16/opinion/cancer-treatment-disparities.html": "health_wellness",
    "https://www.newyorker.com/science/elements/how-food-powers-your-body-metabolism-calorie": "health_wellness",
    "https://www.wsj.com/health/wellness/is-that-food-ultra-processed-how-to-tell-5bf8db05": "health_wellness",
    "https://www.outsideonline.com/food/heart-dark-chocolate/": "health_wellness",
    "https://www.theatlantic.com/health/archive/2013/07/the-vitamin-myth-why-we-think-we-need-supplements/277947/": "health_wellness",
    "https://www.theguardian.com/society/2021/jul/11/unlocking-the-gut-microbiome-and-its-massive-significance-to-our-health": "health_wellness",
    "https://sciencenordic.com/denmark-epidemic-health/how-your-immune-system-combats-infections-like-covid-19/1739725": "health_wellness",
    "https://nautil.us/that-is-not-how-your-brain-works-238138/": "health_wellness",
    "https://www.theguardian.com/lifeandstyle/2024/feb/05/phone-screentime-detox-reflection": "health_wellness",
    # Philosophy
    "https://fivebooks.com/best-books/massimo-pigliucci-stoicism/": "philosophy",
    "https://www.safalniveshak.com/20-ideas-that-changed-my-life/": "philosophy",
    "https://nautil.us/the-remarkable-emptiness-of-existence-256323/": "philosophy",
    "https://www.newyorker.com/magazine/2011/04/25/the-possibilian": "philosophy",
    # Economics / Society
    "https://ig.ft.com/taiwan-economy/": "economics_society",
    "https://www.newyorker.com/magazine/2023/08/21/the-hidden-cost-of-free-returns": "economics_society",
    "https://www.wsj.com/amp/articles/when-will-i-retire-e3750715": "economics_society",
    "https://www.newyorker.com/magazine/2023/02/13/the-astonishing-transformation-of-austin": "economics_society",
    "https://www.ft.com/content/5631cc22-a04d-405c-9154-e307f938f8f3": "economics_society",
    "https://www.npr.org/sections/money/2022/09/06/1120583353/money-management-budgeting-tips": "economics_society",
    "https://www.ft.com/content/03895dc4-a3b7-481e-95cc-336a524f2ac2": "economics_society",
    "https://www.ft.com/content/6cb781f8-f49d-4a14-875d-a2490e46b1cd": "economics_society",
    "https://www.wsj.com/articles/when-spac-man-chamath-palihapitiya-speaks-reddit-and-wall-street-listen-11615006818": "economics_society",
    "https://www.bloomberg.com/features/2022-the-crypto-story/": "economics_society",
    "https://www.ft.com/content/8c166aa4-9fd6-4246-8969-9eee332f9043": "economics_society",
    "https://www.lrb.co.uk/the-paper/v43/n06/thomas-meaney/the-bayswater-grocer": "economics_society",
    "https://www.ft.com/content/eca7988d-2961-4b27-9368-ff58c966e969": "economics_society",
    # Travel / culture → economics_society or human_stories
    "https://www.nytimes.com/2020/12/08/travel/dakar-senegal-vacation-at-home.html": "human_stories",
    "https://www.wsj.com/articles/the-best-of-berlin-via-films-food-music-and-naturally-beer-11615375663": "human_stories",
    "https://www.perceptivetravel.com/issues/1218/kelly.html": "human_stories",
    "https://www.wsj.com/articles/graphene-and-beyond-the-wonder-materials-that-could-replace-silicon-in-future-tech-11616817604": "technology",
}

def classify_batch(urls):
    """Send a batch of URLs to OpenAI for classification. Returns list of dicts."""
    prompt = (
        "You are categorizing articles for a personal reading list.\n"
        "For each URL below, return a JSON array (same order) where each element has:\n"
        "  - title: clean article title inferred from the URL slug and domain\n"
        "  - description: 1-2 sentence summary of what the article is likely about\n"
        "  - category: exactly one of these slugs:\n"
        "    physics_cosmos, biology_life, technology, artificial_intelligence,\n"
        "    human_stories, health_wellness, philosophy, economics_society\n\n"
        "physics_cosmos = physics, space, cosmology, math, time, energy, nuclear\n"
        "biology_life = biology, nature, evolution, cells, ecology, genetics, animals\n"
        "technology = tech, semiconductors, internet infrastructure, batteries, materials\n"
        "artificial_intelligence = AI, machine learning, LLMs, robotics, chatbots\n"
        "human_stories = personal essays, biography, longform journalism, culture, death, relationships\n"
        "health_wellness = medicine, nutrition, fitness, mental health, aging, disease\n"
        "philosophy = philosophy, ethics, ideas, stoicism, consciousness, meaning\n"
        "economics_society = economics, finance, business, politics, society, travel, food\n\n"
        "URLs:\n" + "\n".join(f"{i+1}. {u}" for i, u in enumerate(urls))
    )
    req = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps({
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }).encode(),
        headers={
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        }
    )
    resp = urlopen(req, timeout=30)
    data = json.loads(resp.read())
    content = json.loads(data["choices"][0]["message"]["content"])
    # Handle both {"articles": [...]} and direct [...]
    if isinstance(content, list):
        return content
    for v in content.values():
        if isinstance(v, list):
            return v
    return []

# ── Write to Firestore ──────────────────────────────────────────────────────

def write_to_firestore(item):
    """POST a single document to Firestore REST API."""
    body = {
        "fields": {
            "url":         {"stringValue": item["url"]},
            "title":       {"stringValue": item["title"]},
            "description": {"stringValue": item["description"]},
            "category":    {"stringValue": item["category"]},
            "status":      {"stringValue": "active"},
            "addedAt":     {"stringValue": datetime.utcnow().isoformat() + "Z"},
        }
    }
    req = Request(
        FIRESTORE_URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    resp = urlopen(req, timeout=15)
    return json.loads(resp.read())

def process_batch(urls, batch_num):
    """Classify a batch and write all to Firestore. Returns list of results."""
    print(f"  Batch {batch_num}: classifying {len(urls)} URLs…")
    try:
        classified = classify_batch(urls)
    except Exception as e:
        print(f"  Batch {batch_num}: OpenAI error — {e}")
        return []

    results = []
    for i, url in enumerate(urls):
        item = classified[i] if i < len(classified) else {}
        ai_cat = item.get("category", "economics_society")
        cat = URL_CATEGORIES.get(url) or (ai_cat if ai_cat in VALID_CATEGORIES else "economics_society")
        record = {
            "url": url,
            "title": item.get("title") or url,
            "description": item.get("description", ""),
            "category": cat,
        }
        try:
            write_to_firestore(record)
            results.append(record)
            print(f"    ✓ [{record['category']:15s}] {record['title'][:65]}")
        except Exception as e:
            print(f"    ✗ {url[:60]} — {e}")
    return results

# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=0, help="Start index (0-based)")
    parser.add_argument("--count", type=int, default=10, help="How many URLs to process")
    parser.add_argument("--batch-size", type=int, default=5, help="URLs per OpenAI call")
    parser.add_argument("--workers", type=int, default=2, help="Parallel batches")
    args = parser.parse_args()

    if not OPENAI_KEY:
        print("ERROR: Could not load OPENAI_API_KEY from secrets.js")
        sys.exit(1)

    urls = ALL_URLS[args.start : args.start + args.count]
    # Split into batches
    batches = [urls[i:i+args.batch_size] for i in range(0, len(urls), args.batch_size)]

    print(f"Processing {len(urls)} URLs in {len(batches)} batch(es) ({args.workers} parallel)…\n")

    all_results = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_batch, b, i+1): i for i, b in enumerate(batches)}
        for fut in as_completed(futures):
            all_results.extend(fut.result())

    print(f"\nDone — {len(all_results)}/{len(urls)} written to Firestore.")
    print(f"Total URLs in PDF: {len(ALL_URLS)}")

if __name__ == "__main__":
    main()
