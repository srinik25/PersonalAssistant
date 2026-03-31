#!/usr/bin/env python3
"""Import Travel Bucket List PDF into Firestore bucket_list collection."""
import requests, time, json
from datetime import datetime, timezone

PROJECT = "nutrition-198dd"
URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/bucket_list"
added = errors = 0

def add(country, region, items):
    global added, errors
    doc = {"fields": {
        "country": {"stringValue": country},
        "region":  {"stringValue": region},
        "items":   {"arrayValue": {"values": [{"stringValue": i} for i in items]}},
        "addedAt": {"stringValue": datetime.now(timezone.utc).isoformat()}
    }}
    r = requests.post(URL, json=doc)
    if r.status_code == 200:
        added += 1
        print(f"  ✓ {region} — {country} ({len(items)} items)")
    else:
        errors += 1
        print(f"  ✗ {country}: {r.text[:120]}")
    time.sleep(0.05)

BUCKET = [
    # ── MIDDLE EAST ───────────────────────────────────────────────────────────
    ("UAE — Dubai", "Middle East", [
        "Live locally: Al Fahidi heritage lanes, weekly farmers markets",
        "Friday brunches with Emirati fusion cuisine",
        "Dubai International Film Festival / Alserkal Arts Season",
        "Arabic food cooking class",
        "Ramadan iftar experiences",
        "Sand dune safari",
    ]),
    ("Oman", "Middle East", [
        "Jebel Shams Balcony Walk",
        "Nizwa fort, souq & Friday goat market",
        "Misfat al-Abriyeen falaj irrigation system",
        "Wadi Ghul canyon views",
    ]),
    ("UAE — Abu Dhabi", "Middle East", [
        "Sheikh Zayed Grand Mosque",
        "Louvre Abu Dhabi",
        "Al Ain oasis & Heritage Village",
        "Qasr Al Watan palace",
        "Jebel Hafeet mountain drive",
    ]),
    ("Yemen — Socotra (nice to have)", "Middle East", [
        "Dragon blood trees",
        "Socotri villages",
        "Homhil Plateau hike",
    ]),
    ("Iraq — Kurdistan (nice to have)", "Middle East", [
        "Erbil Citadel",
        "Kurdish food & bazaars",
        "Rawanduz Canyon",
        "Newroz festival visit",
    ]),
    # ── AFRICA ────────────────────────────────────────────────────────────────
    ("Egypt", "Africa", [
        "Pyramids of Giza",
        "Grand Egyptian Museum",
        "Felucca sail at sunset on the Nile",
        "Koshari & taameya food crawl",
        "Day trip to Saqqara / Islamic Cairo walk",
    ]),
    ("Mauritius", "Africa", [
        "Seven Colored Earths & Black River Gorges",
        "Le Morne Brabant hike",
        "Port Louis vibrant market & colonial architecture",
        "Indo-Creole food trail",
    ]),
    ("Seychelles", "Africa", [
        "Vallée de Mai walk",
        "Mahé Victoria curry market",
        "La Digue cycling through coconut groves",
        "Vanilla farms and Creole homes",
    ]),
    ("Réunion", "Africa", [
        "Piton de la Fournaise hike",
        "Creole–French dining",
        "Cirques of Mafate, Cilaos & Salazie (UNESCO)",
    ]),
    ("Rwanda (nice to have)", "Africa", [
        "Gorilla trek",
        "Kigali markets & coffee culture",
        "Inema Arts Center or Ethnographic Museum",
        "Lake Kivu cooperatives",
    ]),
    ("Morocco", "Africa", [
        "Marrakech medina & souqs with tagine cooking class",
        "Chefchaouen Blue City",
        "Sahara dunes at Erg Chigaga with Berber camp stay",
        "Argan oil cooperatives",
    ]),
    ("South Africa (nice to have)", "Africa", [
        "Babylonstoren in the Cape Winelands",
        "Silo Hotel in Cape Town",
        "Cape Town cultural and nature highlights",
    ]),
    ("Botswana", "Africa", [
        "Okavango Delta landscapes — wet season mokoro",
        "Chobe elephants",
    ]),
    ("Namibia", "Africa", [
        "Sossusvlei dunes & Deadvlei",
        "Skeleton Coast shipwrecks",
        "Welwitschia mirabilis hike",
    ]),
    ("Zimbabwe/Zambia — Victoria Falls", "Africa", [
        "Falls viewpoints",
        "Zambezi sunset cruise",
        "Local food markets",
    ]),
    # ── ASIA & PACIFIC ────────────────────────────────────────────────────────
    ("Uzbekistan", "Asia & Pacific", [
        "Samarkand's Registan Square",
        "Bukhara old town",
        "Khiva at sunset",
        "Silk-making workshop in Margilan",
        "Chorsu Bazaar in Tashkent",
    ]),
    ("Tajikistan (nice to have)", "Asia & Pacific", [
        "Pamir Highway",
        "Iskanderkul Lake",
        "Ishkashim border market",
        "Remote village homestays",
    ]),
    ("India", "Asia & Pacific", [
        "Taj Mahal",
        "Ladakh monasteries & Pangong Tso / Tso Moriri viewpoints",
        "Shanti Stupa panorama",
        "Delhi food — Bukhara, chole bhature",
    ]),
    ("Nepal", "Asia & Pacific", [
        "Himalayan panoramas — Nagarkot or Pokhara viewpoints",
        "Kathmandu's Durbar Square",
        "Boudhanath Stupa",
        "Pashupatinath Temple",
        "Bhaktapur's architecture & crafts",
        "Thamel's vibrant atmosphere",
    ]),
    ("Maldives", "Asia & Pacific", [
        "Overwater villa stay",
        "Astronomy dinner cruise",
        "Spa above the reef",
        "Bodu Beru drumming & local island culture",
    ]),
    ("Singapore", "Asia & Pacific", [
        "Stay 1 week — revisit old memories",
        "Hawker centre trail: Maxwell, Lau Pa Sat",
        "Gardens by the Bay conservatories",
    ]),
    ("Thailand — Bangkok", "Asia & Pacific", [
        "Mango sticky rice",
        "Café culture",
        "Chatuchak Market",
    ]),
    ("Thailand — Chiang Mai", "Asia & Pacific", [
        "Temples & old town lanes",
        "Sunday Walking Street",
    ]),
    ("Thailand/Bali — Retreat", "Asia & Pacific", [
        "Yoga or meditation retreat",
        "Veg-friendly food immersions",
        "Cultural workshops",
    ]),
    ("Malaysia — Kuala Lumpur", "Asia & Pacific", [
        "Genting Highlands: cable car, temple terraces, farms",
        "Cameron Highlands: tea plantations, mossy forest, fruit farms",
    ]),
    ("Indonesia — Bali", "Asia & Pacific", [
        "Food & local cuisine",
        "Waterfall viewpoints: Tukad Cepung, Sekumpul",
    ]),
    ("Laos — Luang Prabang", "Asia & Pacific", [
        "Slow down — do nothing",
    ]),
    # ── OCEANIA ───────────────────────────────────────────────────────────────
    ("USA — Hawaii Big Island", "Oceania", [
        "Volcanoes National Park craters",
        "Kona coffee farms",
        "Mauna Kea stargazing",
        "Puʻuhonua o Hōnaunau cultural site",
        "Waipiʻo Valley viewpoints",
    ]),
    ("Fiji (nice to have)", "Oceania", [
        "Nadi & Suva markets",
        "Coral Coast villages",
        "Taveuni's Bouma Falls viewpoints",
        "Colo-I-Suva Forest Park hiking",
        "Kula Eco Park birdlife",
    ]),
    # ── SOUTH AMERICA & CARIBBEAN ─────────────────────────────────────────────
    ("Trinidad & Tobago", "Caribbean", [
        "Carnival in Port of Spain",
        "Caroni Swamp scarlet ibis tour",
        "Asa Wright birding centre",
        "Indo-Caribbean food",
        "Tobago beaches",
    ]),
    ("Argentina", "South America", [
        "Iguazú Falls",
        "Perito Moreno Glacier",
        "Salta's Quebrada de Humahuaca",
        "Cafayate high-altitude vineyards",
    ]),
    ("Colombia (nice to have)", "South America", [
        "Sierra Nevada birding",
        "Cocora Valley wax palms",
    ]),
    ("Ecuador — Galápagos (nice to have)", "South America", [
        "Giant tortoise reserves",
        "Charles Darwin Station",
        "Lava tunnels",
        "Puerto Ayora markets",
    ]),
    # ── NORTH AMERICA ─────────────────────────────────────────────────────────
    ("Mexico — Mexico City", "North America", [
        "World-class cocktail bars",
        "Luis Barragán's modernist architecture",
        "Vibrant food scene: street tacos to fine dining",
        "Las Pozas — Edward James' surrealist garden",
    ]),
    ("USA — Glacier National Park", "North America", [
        "Going-to-the-Sun Road",
        "Hidden Lake hike",
        "Many Glacier wildlife",
    ]),
    ("USA — Yellowstone & Grand Teton", "North America", [
        "Old Faithful geyser",
        "Lamar Valley wildlife viewing",
        "Jenny Lake",
        "Glamping",
    ]),
    ("USA — Utah National Parks (Big Five)", "North America", [
        "Arches: Delicate Arch & rock formations",
        "Zion: scenic drives & Pa'rus Trail",
        "Bryce Canyon: amphitheater & rim trails",
        "Capitol Reef: orchards & Waterpocket Fold",
        "Canyonlands: Island in the Sky & Needles districts",
    ]),
    ("Canada — Banff & Jasper", "North America", [
        "Icefields Parkway",
        "Turquoise lakes: Louise, Moraine, Peyto",
        "Wildlife viewing: elk, bears",
        "Towns of Banff & Jasper",
    ]),
    ("USA — New Mexico (nice to have)", "North America", [
        "Flamenco Festival: Albuquerque/Santa Fe shows",
        "Pueblo art & culture",
        "Taos adobe vibe",
    ]),
    # ── EUROPE ────────────────────────────────────────────────────────────────
    ("Portugal — Azores", "Europe", [
        "Sete Cidades twin lakes",
        "Furnas hot springs & botanical gardens",
        "Cozido das Furnas stew",
        "Diverse coastal hikes",
    ]),
    ("Spain — Canary Islands", "Europe", [
        "Teide NP: lunar landscapes & cable car",
        "La Laguna's UNESCO colonial architecture",
        "La Palma's Starlight Reserve skies",
        "La Gomera: Garajonay NP laurel forest & Silbo Gomero whistling language",
        "Bodegas Monje volcanic wines",
    ]),
    ("Portugal — Madeira", "Europe", [
        "Levada irrigation walks",
        "Pico do Arieiro–Ruivo ridge hike",
        "Funchal Mercado dos Lavradores & old town",
        "Blandy's Wine Lodge",
    ]),
    ("Portugal — Porto", "Europe", [
        "Ribeira riverside",
        "Livraria Lello",
        "Fado performances",
        "Douro Valley vineyards: Quinta do Crasto, Quinta da Pacheca, Graham's",
    ]),
    ("Portugal — Alentejo", "Europe", [
        "Cork forests & hill towns: Évora, Monsaraz",
    ]),
    ("France", "Europe", [
        "Lavender fields near Valensole",
        "Luberon villages: Gordes, Roussillon, Bonnieux",
        "Roman ruins in Arles & Nîmes",
        "Aix-en-Provence markets",
        "Bordeaux: vineyard tours, wine blending workshop, Cité du Vin museum",
        "French Riviera: Moyenne Corniche drive, Nice markets, Antibes old town, Monaco",
        "Strasbourg Christmas market",
    ]),
    ("Italy", "Europe", [
        "Milan: Duomo, Last Supper, Brera design district, Sforza Castle",
        "Genoa: pesto tasting, medieval caruggi lanes, Aquarium, maritime history",
        "Dolomites: Seceda ridgeline, Tre Cime di Lavaredo circuit, Alpe di Siusi meadows",
        "Franciacorta sparkling wine estates",
        "Piedmont: Barolo & Barbaresco wineries",
    ]),
    ("United Kingdom", "Europe", [
        "London: museums, parks, food markets",
        "Oxford & Cambridge: historic colleges, punting, libraries, botanical gardens",
        "Cotswolds countryside villages",
        "Scottish Highlands: dramatic landscapes",
        "Edinburgh: castles, pubs, culture",
    ]),
    ("Ireland — Dublin", "Europe", [
        "Castles, pubs, culture",
    ]),
    ("Norway", "Europe", [
        "Geirangerfjord cruise",
        "Lofoten Islands: dramatic scenery",
        "Oslo: culture",
        "Bergen: harbor & Bryggen",
    ]),
    ("Finland — Helsinki", "Europe", [
        "Design scene",
    ]),
    ("Sweden — Stockholm", "Europe", [
        "Vasa Museum & Gamla Stan old town",
    ]),
    ("Belgium — Bruges", "Europe", [
        "Canals & medieval charm",
        "Christmas markets",
    ]),
    ("Germany — Christmas Markets", "Europe", [
        "Cologne: iconic cathedral backdrop Christmas market",
        "Rothenburg ob der Tauber: fairytale Christmas market",
    ]),
    ("Austria — Christmas", "Europe", [
        "Vienna: festive squares, classical concerts, historic cafés",
        "Hallstatt: Alpine Christmas charm",
    ]),
]

if __name__ == "__main__":
    print(f"Importing {len(BUCKET)} bucket list entries...\n")
    for country, region, items in BUCKET:
        add(country, region, items)
    print(f"\nDone. {added} added, {errors} errors.")
