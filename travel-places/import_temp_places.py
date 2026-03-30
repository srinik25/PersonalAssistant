#!/usr/bin/env python3
"""Import temp places PDF into Firestore."""
import requests, time
from datetime import datetime, timezone

PROJECT = "nutrition-198dd"
URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/travel_places"
added = errors = 0

def add(name, type_, continent, country, state, city, desc=""):
    global added, errors
    doc = {"fields": {
        "continent":   {"stringValue": continent},
        "country":     {"stringValue": country},
        "state":       {"stringValue": state},
        "city":        {"stringValue": city},
        "name":        {"stringValue": name},
        "type":        {"stringValue": type_},
        "description": {"stringValue": desc},
        "addedAt":     {"stringValue": datetime.now(timezone.utc).isoformat()}
    }}
    r = requests.post(URL, json=doc)
    if r.status_code == 200:
        added += 1
        print(f"  ✓ {city} — {name}")
    else:
        errors += 1
        print(f"  ✗ {name}: {r.text[:80]}")
    time.sleep(0.04)

# continent, country, state, city
AM = ("americas", "USA")
EU = ("europe",)
AF = ("africa",)
AS = ("asia",)

PLACES = [
    # ── BALTIMORE, MD ──────────────────────────────────────────────────────────
    ("Baltimore Museum of Art & Gardens",  "place", "americas", "USA", "Maryland",  "Baltimore", "World-class art museum with free admission; beautiful sculpture gardens"),
    ("Clavel",                             "food",  "americas", "USA", "Maryland",  "Baltimore", "Beloved Mexican restaurant in Remington; excellent tacos and mezcal"),
    ("Diablo Donuts",                      "food",  "americas", "USA", "Maryland",  "Baltimore", "Creative donut shop with rotating seasonal flavors"),
    ("Patterson Park",                     "place", "americas", "USA", "Maryland",  "Baltimore", "Large urban park in East Baltimore; Canton Waterfront Park has free parking nearby"),
    ("Peabody Library",                    "place", "americas", "USA", "Maryland",  "Baltimore", "Stunning 19th-century atrium library with five tiers of cast-iron balconies"),
    ("Gunpowder Falls State Park",         "place", "americas", "USA", "Maryland",  "Baltimore", "Scenic river valley with hiking and tubing north of Baltimore"),
    ("Motzi Bread",                        "food",  "americas", "USA", "Maryland",  "Baltimore", "Artisan bakery known for exceptional sourdough loaves and pastries"),
    ("Hersh's Pizza",                      "food",  "americas", "USA", "Maryland",  "Baltimore", "Thin-crust pizza with seasonal toppings; Federal Hill neighborhood gem"),
    ("Yesh Hymmus",                        "food",  "americas", "USA", "Maryland",  "Baltimore", "Israeli-inspired hummus and mezze; bright casual café"),
    ("Pitamore",                           "food",  "americas", "USA", "Maryland",  "Baltimore", "Middle Eastern pita wraps and falafel; quick and delicious"),
    ("Mixit Foodhall",                     "food",  "americas", "USA", "Maryland",  "Baltimore", "Local food hall with rotating vendors and eclectic options"),
    ("Sophomore Coffee",                   "food",  "americas", "USA", "Maryland",  "Baltimore", "Specialty coffee shop in Baltimore"),

    # ── WINCHESTER, VA ─────────────────────────────────────────────────────────
    ("Scalfani Bagels",                    "food",  "americas", "USA", "Virginia",  "Winchester", "New York-style bagels; local Winchester staple"),
    ("Royalicious Bagels",                 "food",  "americas", "USA", "Virginia",  "Winchester", "Hand-rolled bagels with creative cream cheese flavors"),
    ("Big L's Bagels",                     "food",  "americas", "USA", "Virginia",  "Winchester", "Popular bagel spot in Winchester"),
    ("Crash Test Dummies",                 "food",  "americas", "USA", "Virginia",  "Winchester", "Eclectic café and eatery in Winchester"),
    ("Handley Library",                    "place", "americas", "USA", "Virginia",  "Winchester", "Gorgeous Beaux-Arts public library opened 1913; free to visit"),
    ("Tropical Cafe",                      "food",  "americas", "USA", "Virginia",  "Winchester", "Casual café with smoothies and light bites"),
    ("Hopscotch Coffee & Records",         "food",  "americas", "USA", "Virginia",  "Winchester", "Vinyl records and specialty coffee under one roof"),
    ("Abrams Creek Wetlands Preserve",     "place", "americas", "USA", "Virginia",  "Winchester", "Scenic wetlands trail great for birding and a quiet walk"),
    ("Loudoun Street Pedestrian Mall",     "place", "americas", "USA", "Virginia",  "Winchester", "Charming brick pedestrian mall through downtown Winchester"),
    ("Stephens City Drive In",             "experience", "americas", "USA", "Virginia", "Winchester", "Classic drive-in movie theater near Stephens City south of Winchester"),
    ("Bearchase Brewing",                  "food",  "americas", "USA", "Virginia",  "Winchester", "Local craft brewery with a welcoming taproom"),
    ("Central Coffee Roasters",            "food",  "americas", "USA", "Virginia",  "Winchester", "Specialty coffee roaster in downtown Winchester"),
    ("Gray Ghost Vineyards",               "place", "americas", "USA", "Virginia",  "Winchester", "Winery in the Northern Shenandoah Valley; excellent reds"),

    # ── CHARLOTTESVILLE, VA ────────────────────────────────────────────────────
    ("Crabtree Falls",                     "place", "americas", "USA", "Virginia",  "Charlottesville", "Virginia's highest waterfall; 1.7-mile trail close to Charlottesville"),
    ("Pippin Hill Farm & Vineyards",       "food",  "americas", "USA", "Virginia",  "Charlottesville", "Beautiful vineyard with a farm-to-table lunch; stunning Blue Ridge views"),
    ("Early Mountain Vineyard",            "place", "americas", "USA", "Virginia",  "Charlottesville", "Acclaimed winery near Madison; sleek tasting room and gorgeous grounds"),
    ("Oakhart Social",                     "food",  "americas", "USA", "Virginia",  "Charlottesville", "Neighborhood restaurant with an inventive seasonal menu"),
    ("Ivy Creek Natural Area",             "place", "americas", "USA", "Virginia",  "Charlottesville", "5-mile loop through mature forest; peaceful and rarely crowded"),
    ("Hartman Orchard and Mountain Loop Trail", "place", "americas", "USA", "Virginia", "Charlottesville", "Scenic mountain trail with orchard views near Charlottesville"),
    ("Saunders-Monticello Trail",          "place", "americas", "USA", "Virginia",  "Charlottesville", "3-mile trail linking downtown to Monticello through woods and meadows"),
    ("Belle",                              "food",  "americas", "USA", "Virginia",  "Charlottesville", "Restaurant in Charlottesville"),
    ("Albemarle Baking Company",           "food",  "americas", "USA", "Virginia",  "Charlottesville", "Artisan bread bakery; wood-fired loaves and pastries since 1993"),
    ("Vu Noodles",                         "food",  "americas", "USA", "Virginia",  "Charlottesville", "Vietnamese noodles and bánh mì; beloved local spot"),
    ("Inn at Stinson",                     "place", "americas", "USA", "Virginia",  "Charlottesville", "Charming inn near Charlottesville for a relaxing overnight"),
    ("Innisfree Village Crozet",           "place", "americas", "USA", "Virginia",  "Charlottesville", "Therapeutic community in Crozet outside Charlottesville; beautiful farm setting"),
    ("Leander McCormick / Fan Mountain Observatory", "place", "americas", "USA", "Virginia", "Charlottesville", "UVA observatory with public nights; great views of the Blue Ridge"),

    # ── STAUNTON, VA ───────────────────────────────────────────────────────────
    ("Frontier Culture Museum",            "place", "americas", "USA", "Virginia",  "Staunton", "Outdoor living history museum with reconstructed farmsteads from four continents; $12"),
    ("Betsy Bell and Mary Gray Wilderness Park", "place", "americas", "USA", "Virginia", "Staunton", "Twin-peak forested park with trails and city views"),
    ("Sunspots Studio Artisan Center",     "place", "americas", "USA", "Virginia",  "Staunton", "Glass-blowing studio and gallery in downtown Staunton"),
    ("Camera Heritage Museum",             "place", "americas", "USA", "Virginia",  "Staunton", "Unique collection of antique cameras and photographic history"),
    ("Free Walking Tour Staunton",         "experience", "americas", "USA", "Virginia", "Staunton", "Free guided walking tour of beautiful downtown Staunton"),
    ("Crucible Coffee",                    "food",  "americas", "USA", "Virginia",  "Staunton", "Specialty coffee roaster in downtown Staunton"),
    ("Folly Mills Falls",                  "place", "americas", "USA", "Virginia",  "Staunton", "Beautiful waterfall hike near Staunton; good shoes needed"),
    ("Reunion Coffee Shop",                "food",  "americas", "USA", "Virginia",  "Staunton", "Cozy neighborhood coffee shop in Staunton"),
    ("Chicano Taco Boy",                   "food",  "americas", "USA", "Virginia",  "Staunton", "Mexican street tacos and margaritas in downtown Staunton"),
    ("Table 44",                           "food",  "americas", "USA", "Virginia",  "Staunton", "Farm-to-table restaurant in Staunton with a strong local sourcing focus"),
    ("Ravens Roost Overlook",              "place", "americas", "USA", "Virginia",  "Staunton", "Stunning Blue Ridge Parkway overlook at sunset; near Staunton"),
    ("Wade's Mill & Season's Yield Farm",  "place", "americas", "USA", "Virginia",  "Staunton", "Historic grist mill in Raphine producing stone-ground flour; farm store nearby"),

    # ── LEXINGTON, VA ──────────────────────────────────────────────────────────
    ("Boxerwood Gardens and Nature Center","place", "americas", "USA", "Virginia",  "Lexington", "8-acre woodland garden with sculptures and a learning center"),
    ("Lime Kiln Theatre",                  "experience", "americas", "USA", "Virginia", "Lexington", "Outdoor amphitheater in a 19th-century lime kiln; summer concerts and plays"),
    ("Chessie Nature Trail",               "place", "americas", "USA", "Virginia",  "Lexington", "Rail-trail along the Maury River; flat, scenic, and dog-friendly"),
    ("Taps Restaurant",                    "food",  "americas", "USA", "Virginia",  "Lexington", "Craft beer pub with solid food menu in downtown Lexington"),
    ("Pronto Coffee and Gelato",           "food",  "americas", "USA", "Virginia",  "Lexington", "Coffee and artisan gelato in a charming downtown spot"),
    ("Heliotrope Brewing",                 "food",  "americas", "USA", "Virginia",  "Lexington", "Craft brewery with Neapolitan pizza and outdoor seating"),
    ("Globowl Cafe",                       "food",  "americas", "USA", "Virginia",  "Lexington", "Global-inspired grain bowls and wraps; popular with college crowd"),
    ("Douthat State Park",                 "place", "americas", "USA", "Virginia",  "Lexington", "Scenic state park with hiking, fishing, and a mountain lake; near Lexington"),
    ("Seasons Yield Farm",                 "food",  "americas", "USA", "Virginia",  "Lexington", "Farm bakery and B&B in Raphine; fresh-baked goods and pastoral setting"),

    # ── MUSIC VENUES (mid-Atlantic) ────────────────────────────────────────────
    ("Birchmere Music Hall",               "experience", "americas", "USA", "Virginia", "Alexandria", "Legendary intimate music hall; folk, bluegrass, and Americana since 1966"),
    ("Tally Ho Theater",                   "experience", "americas", "USA", "Virginia", "Leesburg", "Historic downtown Leesburg music venue with eclectic bookings"),
    ("Floyd Friday Night Jamboree",        "experience", "americas", "USA", "Virginia", "Floyd", "Free weekly old-time and bluegrass music at the country store; every Friday night"),
    ("Floyd Fest",                         "experience", "americas", "USA", "Virginia", "Floyd", "Annual multi-day music festival on the Blue Ridge Plateau; world music and roots"),
    ("Merriweather Post Pavilion",         "experience", "americas", "USA", "Maryland", "Columbia", "Major outdoor concert venue in Columbia, MD; top national acts all summer"),
    ("Barns of Rose Hill",                 "experience", "americas", "USA", "Virginia", "Berryville", "Intimate listening room in a restored barn in Berryville; excellent acoustics"),
    ("Mary Louise Jackson Amphitheatre",   "experience", "americas", "USA", "Virginia", "Manassas", "Outdoor amphitheater in Manassas for summer concerts"),
    ("Farm Brew Live",                     "experience", "americas", "USA", "Virginia", "Manassas", "Outdoor music and craft beer festival venue in Manassas"),
    ("Jiffy Lube Live",                    "experience", "americas", "USA", "Virginia", "Bristow", "Large outdoor amphitheater in Bristow; major touring acts"),
    ("Fort Reno Summer Concert Series",    "experience", "americas", "USA", "District of Columbia", "Washington DC", "Free summer concerts at Fort Reno Park in Tenleytown; indie and punk"),
    ("Red Wing Roots Music Festival",      "experience", "americas", "USA", "Virginia", "Mount Solon", "Annual July folk and roots music festival at Natural Chimneys Park"),

    # ── VA GENERAL ─────────────────────────────────────────────────────────────
    ("Hungry Mother State Park Molly Knob Trail", "place", "americas", "USA", "Virginia", "Marion", "Challenging out-and-back hike to Molly Knob with panoramic Southwest Virginia views"),

    # ── NORTH CAROLINA ─────────────────────────────────────────────────────────
    ("Nantahala National Forest",          "place", "americas", "USA", "North Carolina", "Bryson City", "Vast national forest with world-class whitewater, waterfalls, and the AT"),
    ("Boone",                              "place", "americas", "USA", "North Carolina", "Boone", "Charming mountain college town on the Blue Ridge; great food scene and hiking"),

    # ── JIM THORPE, PA ─────────────────────────────────────────────────────────
    ("Lehigh Gorge State Park Hike",       "place", "americas", "USA", "Pennsylvania", "Jim Thorpe", "Dramatic gorge trail along the Lehigh River; popular for hiking and biking"),
    ("Mount Pisgah Trail",                 "place", "americas", "USA", "Pennsylvania", "Jim Thorpe", "Wooded trail above Jim Thorpe with ridge views"),
    ("Tank Hollow Trail",                  "place", "americas", "USA", "Pennsylvania", "Jim Thorpe", "Quiet forest trail in the Jim Thorpe area"),
    ("Moya Restaurant",                    "food",  "americas", "USA", "Pennsylvania", "Jim Thorpe", "Creative tapas and craft cocktails in a historic building in Jim Thorpe"),
    ("Glen Onoko Falls",                   "place", "americas", "USA", "Pennsylvania", "Jim Thorpe", "Series of cascading waterfalls accessible by trail from Jim Thorpe"),
    ("Flagstaff Mountain Overlook",        "place", "americas", "USA", "Pennsylvania", "Jim Thorpe", "Overlook above Jim Thorpe with sweeping views of the Lehigh Valley"),

    # ── WAYNESBORO, VA ─────────────────────────────────────────────────────────
    ("Ridgeview River Amphitheatre",       "experience", "americas", "USA", "Virginia", "Waynesboro", "Outdoor performance venue by the South River in Waynesboro"),
    ("Shenandoah Valley Art Center",       "place", "americas", "USA", "Virginia", "Waynesboro", "Regional art center with galleries and rotating exhibitions"),
    ("Wintergreen Resort",                 "place", "americas", "USA", "Virginia", "Waynesboro", "Mountain resort with skiing, hiking, and Blue Ridge views near Waynesboro"),
    ("Farmhaus Coffee Co",                 "food",  "americas", "USA", "Virginia", "Waynesboro", "Cozy specialty coffee shop in downtown Waynesboro"),
    ("Buckley Moss Gallery",               "place", "americas", "USA", "Virginia", "Waynesboro", "Gallery featuring P. Buckley Moss's distinctive Shenandoah Valley folk art"),
    ("Stablecraft Brewing",                "food",  "americas", "USA", "Virginia", "Waynesboro", "Taproom in a converted stable with local craft beers"),

    # ── HARRISONBURG, VA ───────────────────────────────────────────────────────
    ("Boboko Indonesian",                  "food",  "americas", "USA", "Virginia", "Harrisonburg", "Authentic Indonesian cuisine; rare find in the Shenandoah Valley"),
    ("Bella Luna Woodfired Pizza",         "food",  "americas", "USA", "Virginia", "Harrisonburg", "Neapolitan-style pizza from a wood-fired oven"),
    ("Heritage Bakery & Café",             "food",  "americas", "USA", "Virginia", "Harrisonburg", "Artisan bakery celebrated for elaborate custom cakes and pastries"),
    ("Babylon Lebanese Bakery",            "food",  "americas", "USA", "Virginia", "Harrisonburg", "Lebanese flatbread (khubz arabi) and Mediterranean groceries"),
    ("Vietopia",                           "food",  "americas", "USA", "Virginia", "Harrisonburg", "Vietnamese bánh mì and pho; budget-friendly and delicious"),
    ("Xenia Kabob Grill",                  "food",  "americas", "USA", "Virginia", "Harrisonburg", "Greek souvlaki and Mediterranean grilled meats"),
    ("Edith J. Carrier Arboretum",         "place", "americas", "USA", "Virginia", "Harrisonburg", "JMU's 125-acre arboretum with wildflower meadows and woodland trails"),
    ("Mineral Museum JMU",                 "place", "americas", "USA", "Virginia", "Harrisonburg", "James Madison University mineral and geology collection; free"),
    ("Showalter's Orchard and Greenhouse", "place", "americas", "USA", "Virginia", "Harrisonburg", "Pick-your-own apple orchard and greenhouse in the Shenandoah Valley"),
    ("Hillendale Park",                    "place", "americas", "USA", "Virginia", "Harrisonburg", "Large city park with disc golf, trails, and picnic areas"),
    ("White Oak Lavender Farm",            "place", "americas", "USA", "Virginia", "Harrisonburg", "Lavender farm with artisan products and homemade lavender ice cream"),
    ("Lake Shenandoah Trail (Pollinator)", "place", "americas", "USA", "Virginia", "Harrisonburg", "Loop trail around Lake Shenandoah with pollinator meadows"),
    ("Reddish Knob",                       "place", "americas", "USA", "Virginia", "Harrisonburg", "Drive-to summit at 4,397 ft with 360° views; spectacular in fall foliage"),
    ("Brandywine Recreation Area",         "place", "americas", "USA", "West Virginia", "Brandywine", "WV recreation area just across the VA border; camping, hiking, and trout fishing"),
    ("Sawmill Loop Trail GW National Forest", "place", "americas", "USA", "Virginia", "Harrisonburg", "Quiet loop trail in George Washington National Forest"),
    ("Shenandoah Joe Coffee",              "food",  "americas", "USA", "Virginia", "Harrisonburg", "Local specialty coffee roaster; the best café in Harrisonburg"),
    ("Broad Porch Coffee",                 "food",  "americas", "USA", "Virginia", "Harrisonburg", "Neighborhood café with a welcoming porch vibe"),
    ("Merge Coffee",                       "food",  "americas", "USA", "Virginia", "Harrisonburg", "Specialty coffee shop in Harrisonburg"),
    ("Route 11 Potato Chips",              "food",  "americas", "USA", "Virginia", "Harrisonburg", "Kettle-cooked chip factory with free tastings; made in the Shenandoah Valley"),
    ("Magpie Diner",                       "food",  "americas", "USA", "Virginia", "Harrisonburg", "Classic American diner fare in a cheerful setting"),
    ("Mt. Crawford Creamery",              "food",  "americas", "USA", "Virginia", "Harrisonburg", "Farm ice cream stand with fresh-made flavors from local dairy"),

    # ── ROANOKE, VA ────────────────────────────────────────────────────────────
    ("Bloom Tapas Bar",                    "food",  "americas", "USA", "Virginia", "Roanoke", "Creative small plates and cocktails in downtown Roanoke"),
    ("Taubman Museum of Art",              "place", "americas", "USA", "Virginia", "Roanoke", "Frank Gehry-designed art museum with free general admission"),
    ("Smith Mountain Lake",                "place", "americas", "USA", "Virginia", "Roanoke", "Virginia's largest freshwater lake; boating, swimming, and gorgeous sunsets"),
    ("Hotel Roanoke",                      "place", "americas", "USA", "Virginia", "Roanoke", "Historic 1882 Tudor-style hotel; a Roanoke landmark for dining and cocktails"),
    ("Rnd Coffee",                         "food",  "americas", "USA", "Virginia", "Roanoke", "Specialty coffee shop in Roanoke"),
    ("KJ's Kabob Grill",                   "food",  "americas", "USA", "Virginia", "Roanoke", "Afghan and Middle Eastern kabobs and rice dishes in Roanoke"),

    # ── PITTSBURGH, PA ─────────────────────────────────────────────────────────
    ("Farmer + Baker",                     "food",  "americas", "USA", "Pennsylvania", "Pittsburgh", "Artisan bagel and sandwich shop in Pittsburgh"),
    ("Bitter Ends Garden & Luncheonette",  "food",  "americas", "USA", "Pennsylvania", "Pittsburgh", "Plant nursery and lunch spot; garden salads and soups in a greenhouse setting"),
    ("KLVN Coffee Lab",                    "food",  "americas", "USA", "Pennsylvania", "Pittsburgh", "Specialty coffee shop in Pittsburgh"),
    ("Mediterra Bakehouse",                "food",  "americas", "USA", "Pennsylvania", "Pittsburgh", "Artisan wood-fired bread bakery; sourdough and levain loaves"),
    ("DiAnoia's Eatery",                   "food",  "americas", "USA", "Pennsylvania", "Pittsburgh", "Pittsburgh's best Italian restaurant; handmade pasta and cured meats; open after 4 PM"),
    ("West End Overlook",                  "place", "americas", "USA", "Pennsylvania", "Pittsburgh", "Panoramic overlook of downtown Pittsburgh and the three rivers"),
    ("Point State Park",                   "place", "americas", "USA", "Pennsylvania", "Pittsburgh", "Iconic park at the confluence of three rivers; great city views"),
    ("Apteka",                             "food",  "americas", "USA", "Pennsylvania", "Pittsburgh", "Vegan Eastern European restaurant in Polish Hill; exceptional pierogies and borscht"),
    ("Schenley Park",                      "place", "americas", "USA", "Pennsylvania", "Pittsburgh", "Large urban park with trails, tennis, ice skating, and Phipps Conservatory nearby"),
    ("North Shore Riverfront Park",        "place", "americas", "USA", "Pennsylvania", "Pittsburgh", "Riverside park along the Allegheny with stadium views and walking paths"),

    # ── PORT OF SPAIN, TRINIDAD ────────────────────────────────────────────────
    ("Meena House",                        "food",  "americas", "Trinidad and Tobago", "", "Port of Spain", "Beloved local spot for Indian-Caribbean roti and doubles"),
    ("Pax Guesthouse Afternoon Tea",       "experience", "americas", "Trinidad and Tobago", "", "Port of Spain", "Afternoon tea on the hilltop veranda at Pax Guesthouse in Mount St. Benedict"),

    # ── CANARY ISLANDS, SPAIN ──────────────────────────────────────────────────
    ("La Gomera Cloud Forest Hike",        "place", "europe", "Spain", "Canary Islands", "La Gomera", "Hike from cloud forest to desert canyon; one of Europe's most dramatic trail contrasts"),

    # ── BANGKOK, THAILAND ──────────────────────────────────────────────────────
    ("Volks Bagels",                       "food",  "asia", "Thailand", "", "Bangkok", "New York-style bagels in Bangkok; a great weekend brunch option"),
    ("Nana Coffee Roasters",               "food",  "asia", "Thailand", "", "Bangkok", "Specialty coffee roaster in the Ari neighborhood; excellent pour-overs"),
    ("Vacode Cafe",                        "food",  "asia", "Thailand", "", "Bangkok", "Stylish café in Bangkok known for coffee and aesthetics"),
    ("Ari Neighborhood",                   "place", "asia", "Thailand", "", "Bangkok", "Trendy Bangkok neighborhood with independent cafés, restaurants, and boutiques"),

    # ── LONDON, UK ─────────────────────────────────────────────────────────────
    ("Bibi",                               "food",  "europe", "United Kingdom", "England", "London", "Modern Indian restaurant in Mayfair; inventive small plates and cocktails"),
    ("Dishoom",                            "food",  "europe", "United Kingdom", "England", "London", "Iconic Bombay-style café; the black dal and bacon naan are legendary"),

    # ── YORK, UK ───────────────────────────────────────────────────────────────
    ("York City Walls & Medieval Quarter", "place", "europe", "United Kingdom", "England", "York", "Walk the intact Roman/medieval walls; explore the Shambles and York Minster"),

    # ── MARRAKECH, MOROCCO ─────────────────────────────────────────────────────
    ("Marrakech Medina",                   "place", "africa", "Morocco", "", "Marrakech", "UNESCO-listed medina with souks, riads, Jemaa el-Fna square, and the Koutoubia Mosque"),
]

if __name__ == "__main__":
    print(f"Importing {len(PLACES)} places from temp places PDF...\n")
    for p in PLACES:
        name, type_, continent, country, state, city, *rest = p
        desc = rest[0] if rest else ""
        add(name, type_, continent, country, state, city, desc)
    print(f"\nDone. {added} added, {errors} errors.")
