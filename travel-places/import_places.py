#!/usr/bin/env python3
"""Import all travel places from PDFs into Firestore travel_places collection."""
import requests, json, time
from datetime import datetime, timezone

PROJECT = "nutrition-198dd"
URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/travel_places"

added = 0
errors = 0

def add(continent, country, state, city, name, type_, desc=""):
    global added, errors
    doc = {"fields": {
        "continent": {"stringValue": continent},
        "country":   {"stringValue": country},
        "state":     {"stringValue": state},
        "city":      {"stringValue": city or "General"},
        "name":      {"stringValue": name},
        "type":      {"stringValue": type_},
        "description": {"stringValue": desc},
        "addedAt":   {"stringValue": datetime.now(timezone.utc).isoformat()}
    }}
    r = requests.post(URL, json=doc)
    if r.status_code == 200:
        added += 1
        print(f"  ✓ [{continent}] {country}{(' / '+state) if state else ''} / {city or 'General'} — {name}")
    else:
        errors += 1
        print(f"  ✗ {name}: {r.status_code} {r.text[:80]}")
    time.sleep(0.04)

# fmt: (continent, country, state, city, name, type_, description)
PLACES = [
    # ── MIDDLE EAST ────────────────────────────────────────────────────────────
    # Dubai / UAE
    ("middle_east","UAE","","Dubai","Al Fahidi Heritage District","place","Historic wind-tower lanes, art galleries, the Coffee Museum, and abra boat rides"),
    ("middle_east","UAE","","Dubai","Friday Brunch with Emirati Fusion","food","Traditional Friday brunch experience with Emirati and fusion cuisine"),
    ("middle_east","UAE","","Dubai","Arabic Food Cooking Class","food","Learn to cook classic Arabic dishes near Bastakiya or in a luxury hotel kitchen"),
    ("middle_east","UAE","","Dubai","Ramadan Iftar Experience","food","Breaking fast at dusk with dates, harees, and traditional spreads at a heritage venue"),
    ("middle_east","UAE","","Dubai","Sand Dune Safari","place","Evening dune bashing, camel ride, and stargazing in the Dubai desert"),
    ("middle_east","UAE","","Dubai","Alserkal Arts Season","place","Contemporary art shows and cultural events in Al Quoz creative district"),
    # Oman
    ("middle_east","Oman","","Nizwa","Nizwa Fort & Friday Goat Market","place","Ancient fort with dramatic keep; Friday morning livestock souq below the walls"),
    ("middle_east","Oman","","Jebel Shams","Jebel Shams Balcony Walk","place","Dramatic canyon rim trail above Wadi Ghul — Oman's Grand Canyon"),
    ("middle_east","Oman","","Al Hamra","Misfat al-Abriyeen","place","Ancient stone village with traditional falaj irrigation channels"),
    ("middle_east","Oman","","Wadi Ghul","Wadi Ghul Canyon Views","place","Sweeping views into the 1,000m gorge; fold-up chairs and roadside tea shops"),
    # Abu Dhabi
    ("middle_east","UAE","","Abu Dhabi","Sheikh Zayed Grand Mosque","place","One of the world's largest mosques; stunning white marble and 82 domes"),
    ("middle_east","UAE","","Abu Dhabi","Louvre Abu Dhabi","place","Jean Nouvel's stunning museum under a geometric latticed dome"),
    ("middle_east","UAE","","Abu Dhabi","Al Ain Oasis","place","UNESCO-listed ancient oasis with 147,000 date palms and falaj waterways"),
    ("middle_east","UAE","","Abu Dhabi","Qasr Al Watan Palace","place","Grand presidential palace open for cultural visits; stunning light show evenings"),
    ("middle_east","UAE","","Abu Dhabi","Jebel Hafeet Mountain Drive","place","Serpentine road to 1,340m summit; views over Al Ain and into Oman"),
    # Uzbekistan
    ("asia","Uzbekistan","","Samarkand","Registan Square","place","Three monumental madrassas in glittering tilework — the heart of the Silk Road"),
    ("asia","Uzbekistan","","Bukhara","Bukhara Old Town","place","UNESCO old city with 140+ monuments, minarets, and caravanserai intact"),
    ("asia","Uzbekistan","","Khiva","Khiva at Sunset","place","Walled Itchan Kala glows in golden light — best seen from the outer walls at dusk"),
    ("asia","Uzbekistan","","Tashkent","Chorsu Bazaar","place","Iconic domed bazaar selling spices, dried fruits, samsa, and bread"),
    ("asia","Uzbekistan","","Fergana Valley","Silk-Making Workshop, Margilan","place","Traditional ikat silk weaving in the ancient craft town of Margilan"),
    # Yemen / Iraq / Tajikistan
    ("middle_east","Yemen","","Socotra","Dragon Blood Trees, Socotra","place","Alien-looking Dracaena trees unique to the island; Homhil Plateau hike"),
    ("middle_east","Iraq","","Erbil","Erbil Citadel","place","One of the oldest continuously inhabited sites in the world; 6,000 years of history"),
    ("middle_east","Iraq","","Rawanduz","Rawanduz Canyon","place","Dramatic gorge in Kurdistan Region; scenic mountain drives and tea houses"),
    ("asia","Tajikistan","","Murghab","Pamir Highway","place","High-altitude road through the Roof of the World; epic desolate landscapes"),
    ("asia","Tajikistan","","Iskanderkul","Iskanderkul Lake","place","Turquoise mountain lake surrounded by peaks; Alexander the Great lore"),

    # ── AFRICA ─────────────────────────────────────────────────────────────────
    # Egypt
    ("africa","Egypt","","Giza","Pyramids of Giza","place","The only surviving ancient wonder; best at dawn before the crowds"),
    ("africa","Egypt","","Cairo","Grand Egyptian Museum","place","World-class museum with Tutankhamun's complete 5,000-piece collection"),
    ("africa","Egypt","","Cairo","Felucca Sail at Sunset on the Nile","place","Traditional wooden sailboat at dusk; arrange at Corniche el Nil in Aswan or Cairo"),
    ("africa","Egypt","","Cairo","Koshari & Taameya Crawl","food","Egypt's national street dishes: koshari (lentil-pasta mix) and fava fritters"),
    ("africa","Egypt","","Saqqara","Saqqara Step Pyramid","place","Oldest stone structure in the world; far less crowded than Giza"),
    ("africa","Egypt","","Cairo","Islamic Cairo Walk","place","Al-Muizz Street medieval mosques, minarets, and Khan el-Khalili bazaar"),
    # Mauritius
    ("africa","Mauritius","","Chamarel","Seven Colored Earths","place","Volcanic dunes in seven shades of red, brown, violet, and green"),
    ("africa","Mauritius","","Black River","Black River Gorges NP","place","Dramatic gorges and endemic bird species in the island's wildest corner"),
    ("africa","Mauritius","","Le Morne","Le Morne Brabant Hike","place","UNESCO mountain with poignant slave history; views over turquoise lagoon"),
    ("africa","Mauritius","","Port Louis","Port Louis Market & Colonial Architecture","place","Central Market, Blue Penny Museum, and Champs de Mars racecourse"),
    ("africa","Mauritius","","General","Indo-Creole Food Trail","food","Dholl puri, bol renversé, and seafood vindaye across the island"),
    # Seychelles
    ("africa","Seychelles","","Praslin","Vallée de Mai Walk","place","UNESCO palm forest with wild coco de mer palms; black parrots overhead"),
    ("africa","Seychelles","","Mahé","Victoria Curry Market","food","Tiny capital's market with Creole spices, fresh fish, and tropical produce"),
    ("africa","Seychelles","","La Digue","La Digue Cycling","place","Rent a bike; cycle through vanilla farms, Creole homes, and to Anse Source d'Argent"),
    # Réunion
    ("africa","Réunion","","Piton de la Fournaise","Piton de la Fournaise Hike","place","Active volcano caldera walk; one of the world's most accessible lava fields"),
    ("africa","Réunion","","Cilaos","Cirque de Cilaos","place","UNESCO dramatic volcanic cirque; lentil wine, hiking, and canyoning"),
    ("africa","Réunion","","Mafate","Cirque de Mafate","place","Car-free cirque accessible only on foot or helicopter; isolated villages"),
    ("africa","Réunion","","General","Creole-French Dining","food","Cari, rougail, and fresh vanilla — Réunion's sublime fusion cuisine"),
    # Rwanda
    ("africa","Rwanda","","Volcanoes NP","Gorilla Trek","place","Habituated mountain gorilla families in Volcanoes National Park; UNESCO"),
    ("africa","Rwanda","","Kigali","Kigali Markets & Coffee Culture","place","Kimironko Market, specialty coffee, and Inema Arts Center"),
    ("africa","Rwanda","","Lake Kivu","Lake Kivu","place","Scenic freshwater lake; boat to Rubavu for sunsets and lake fish lunches"),
    # Morocco
    ("africa","Morocco","","Marrakech","Marrakech Medina & Souqs","place","Jemaa el-Fna square, labyrinthine souqs, riads, and tanneries"),
    ("africa","Morocco","","Marrakech","Tagine Cooking Class","food","Learn to make lamb or vegetable tagine with local spices in a riad kitchen"),
    ("africa","Morocco","","Chefchaouen","Chefchaouen Blue City","place","Rif mountain town painted in shades of blue; photogenic lanes and crafts"),
    ("africa","Morocco","","Sahara","Erg Chigaga Dunes","place","Remote Sahara dunes with Berber camp stay; camel trek and stargazing"),
    ("africa","Morocco","","Souss-Massa","Argan Oil Cooperatives","place","Women's cooperatives pressing argan oil by hand; buy direct from source"),
    # South Africa
    ("africa","South Africa","","Franschhoek","Babylonstoren Farm Stay","place","Historic Cape Dutch estate with biodynamic garden, farm-to-table restaurant, and spa"),
    ("africa","South Africa","","Cape Town","Silo Hotel & Zeitz MOCAA","place","Converted grain silo with Africa's largest contemporary art museum inside"),
    # Botswana
    ("africa","Botswana","","Okavango","Okavango Delta","place","Mokoro canoe through papyrus channels; wetland wildlife spectacle in wet season"),
    ("africa","Botswana","","Chobe","Chobe National Park","place","World's highest elephant concentration; sunrise river safari"),
    # Namibia
    ("africa","Namibia","","Sossusvlei","Sossusvlei Dunes & Deadvlei","place","Apricot-red dunes up to 325m; white salt pan with ancient dead camel-thorn trees"),
    ("africa","Namibia","","Skeleton Coast","Skeleton Coast","place","Eerie fog-shrouded shipwrecks, fur seal colonies, and desert-adapted wildlife"),
    # Zimbabwe / Victoria Falls
    ("africa","Zimbabwe","","Victoria Falls","Victoria Falls Viewpoints","place","Devil's Cataract to Main Falls; best April–May when flow peaks"),
    ("africa","Zimbabwe","","Victoria Falls","Zambezi Sunset Cruise","place","Hippos and elephants at the water's edge; sundowner cruise on the Zambezi"),

    # ── SOUTH ASIA ─────────────────────────────────────────────────────────────
    # India
    ("asia","India","","Agra","Taj Mahal","place","Marble mausoleum at sunrise; arrive before 7am for golden light and fewer crowds"),
    ("asia","India","","Leh","Ladakh Monasteries","place","Thiksey, Diskit, and Hemis monasteries amid dramatic high-altitude landscapes"),
    ("asia","India","","Ladakh","Pangong Tso Lake","place","Brilliant blue lake straddling India–China border; otherworldly silence at 4,350m"),
    ("asia","India","","Leh","Shanti Stupa Panorama","place","Hilltop peace stupa with panoramic views over Leh valley; golden at dusk"),
    ("asia","India","","Delhi","Bukhara Restaurant","food","ITC Maurya's legendary tandoor restaurant; Dal Bukhara and Murgh Malai Kebab"),
    ("asia","India","","Delhi","Chole Bhature Crawl","food","Classic Delhi breakfast: fluffy bhature with spiced chole; try Sita Ram near Paharganj"),
    # Nepal
    ("asia","Nepal","","Nagarkot","Himalayan Panorama, Nagarkot","place","Pre-dawn drive for Everest sunrise views; guesthouse rooftop with sweeping Himalayan sweep"),
    ("asia","Nepal","","Kathmandu","Boudhanath Stupa","place","Massive white dome with watchful Buddha eyes; Tibetan butter tea at surrounding cafes"),
    ("asia","Nepal","","Kathmandu","Pashupatinath Temple","place","Sacred Hindu cremation ghats on the Bagmati; sadhus and ancient shrines"),
    ("asia","Nepal","","Bhaktapur","Bhaktapur Durbar Square","place","Preserved medieval Newari architecture; best at dawn before tourist buses arrive"),
    ("asia","Nepal","","Pokhara","Pokhara Lakeside & Phewa Lake","place","Annapurna reflections on the lake; paragliding and sunrise treks to Poon Hill"),
    # Maldives
    ("asia","Maldives","","Ari Atoll","Overwater Villa Stay","place","Sunrise over Indian Ocean from your deck; bioluminescent plankton beach at night"),
    ("asia","Maldives","","General","Astronomy Dinner Cruise","place","Stargazing on the open ocean; zero light pollution for Milky Way views"),
    ("asia","Maldives","","General","Bodu Beru Drumming","place","Traditional Maldivian percussion performance; hypnotic crescendos and dancing"),

    # ── ASIA ───────────────────────────────────────────────────────────────────
    # Singapore
    ("asia","Singapore","","Singapore","Maxwell Food Centre","food","Hawker centre with Tian Tian Hainanese chicken rice; arrive by 11am to beat the queue"),
    ("asia","Singapore","","Singapore","Lau Pa Sat Hawker Centre","food","Victorian cast-iron market hall; satay street comes alive at night"),
    ("asia","Singapore","","Singapore","Gardens by the Bay Conservatories","place","Cloud Forest and Flower Dome; misty mountain waterfall under glass domes"),
    # Thailand - Bangkok
    ("asia","Thailand","","Bangkok","Chatuchak Weekend Market","place","35 acres, 15,000 stalls; best for crafts, vintage, plants, and street food"),
    ("asia","Thailand","","Bangkok","Mango Sticky Rice","food","Khao niaow ma muang at Or Tor Kor Market; peak mango season April–June"),
    ("asia","Thailand","","Bangkok","Bangkok Specialty Café Crawl","food","Roots Coffee, Brave Roasters, and Ari café culture in the old town"),
    # Thailand - Chiang Mai
    ("asia","Thailand","","Chiang Mai","Old Town Temples","place","Wat Chedi Luang, Wat Phra Singh, and Wat Suan Dok — all walkable at dawn"),
    ("asia","Thailand","","Chiang Mai","Sunday Walking Street","place","Wualai Road transforms at dusk with street food, crafts, and live music"),
    # Malaysia
    ("asia","Malaysia","","Genting Highlands","Genting Highlands","place","Cable car up through cloud forest; Chin Swee Temple terraces and highland farms"),
    ("asia","Malaysia","","Cameron Highlands","Cameron Highlands Tea Plantations","place","BOH tea estate, mossy forest hike, and fresh strawberry farms in the highlands"),
    # Indonesia - Bali
    ("asia","Indonesia","","Bali","Tukad Cepung Waterfall","place","Secret waterfall in a slot canyon; light rays pierce the mist around 10am"),
    ("asia","Indonesia","","Bali","Sekumpul Waterfall","place","Bali's most impressive waterfall cluster; 45-min jungle descent with local guide"),
    ("asia","Indonesia","","Bali","Bali Food & Temple Circuit","food","Warung Babi Guling Ibu Oka, Jimbaran seafood, and Ubud organic cafés"),
    # Laos
    ("asia","Laos","","Luang Prabang","Luang Prabang","place","Slow mornings watching monks collect alms; Kuang Si waterfall and French bakeries"),
    # Retreat
    ("asia","Thailand","","General","Yoga or Meditation Retreat","place","Veg-friendly food immersions and cultural workshops; look in Pai or Koh Phangan"),

    # ── OCEANIA ────────────────────────────────────────────────────────────────
    # Fiji
    ("oceania","Fiji","","Taveuni","Bouma Falls & Lavena Coastal Walk","place","Rainforest waterfall trek followed by a coastal walk on Fiji's garden island"),
    ("oceania","Fiji","","Suva","Suva Municipal Market","place","Enormous produce market with kava, tropical fruit, and fresh seafood"),
    ("oceania","Fiji","","Coral Coast","Kula Eco Park","place","Native wildlife park; birdlife, iguanas, and Fiji's endemic species"),

    # ── AMERICAS — USA: Hawaii ─────────────────────────────────────────────────
    # Hawaii Big Island — from Bucket List
    ("americas","USA","Hawaii","Hawaii Volcanoes NP","Hawaii Volcanoes National Park","place","Halemaʻumaʻu crater overlook, Chain of Craters Road, and Thurston Lava Tube"),
    ("americas","USA","Hawaii","Mauna Kea","Mauna Kea Summit Stargazing","place","Summit at 4,200m above cloud layer; best stargazing in the Northern Hemisphere"),
    ("americas","USA","Hawaii","South Kona","Puʻuhonua o Hōnaunau","place","Place of Refuge national historical park; reconstructed heiau and royal fishponds"),
    ("americas","USA","Hawaii","Waipiʻo Valley","Waipiʻo Valley Overlook","place","Sacred valley of kings; dramatic lookout with black sand beach far below"),
    # Hawaii — from Hawaii.pdf (Hilo)
    ("americas","USA","Hawaii","Hilo","Hilo Farmers Market","place","Wednesday and Saturday market; tropical fruit, flowers, and local crafts"),
    ("americas","USA","Hawaii","Hilo","Lava Lava Beach Club","food","Sunset dinner with toes in the sand at Anaehoʻomalu Bay; fresh fish and mai tais"),
    # Hawaii — from Hawaii.pdf (Kona)
    ("americas","USA","Hawaii","Kona","Journey Cafe","food","Veg-friendly cafe known for collard green wraps and healthy bowls"),
    ("americas","USA","Hawaii","Kona","Laulima Food Patch","food","Farm-to-table restaurant on a working organic farm"),
    ("americas","USA","Hawaii","Kona","Kona Coffee and Tea","food","Mayan coffee blend and specialty brewing at a beloved local cafe"),
    ("americas","USA","Hawaii","Kona","Lions Gate Farm","place","Coffee and macadamia farm tour; appointment needed"),
    ("americas","USA","Hawaii","Kona","Kaloko-Honokohau National Historical Park","place","Ancient fishponds, petroglyphs, and sea turtle habitat along the Kona coast"),
    ("americas","USA","Hawaii","Kona","Hulihee Palace","place","19th-century royal summer palace turned museum on the Kona waterfront"),

    # ── AMERICAS — USA: Montana / Yellowstone ─────────────────────────────────
    ("americas","USA","Montana","Glacier NP","Going-to-the-Sun Road","place","America's most scenic mountain road; Logan Pass at 6,646 ft with mountain goats"),
    ("americas","USA","Montana","Glacier NP","Hidden Lake Hike","place","Trail from Logan Pass to Hidden Lake Overlook; wildflowers and mountain goats in summer"),
    ("americas","USA","Montana","Glacier NP","Many Glacier Valley","place","Best wildlife viewing area; grizzlies, moose, wolves, and bighorn sheep"),
    ("americas","USA","Wyoming","Yellowstone","Old Faithful Geyser","place","Erupts roughly every 90 minutes; explore the Upper Geyser Basin boardwalk"),
    ("americas","USA","Wyoming","Yellowstone","Lamar Valley","place","America's Serengeti; wolf packs, bison herds, and grizzlies at dawn"),
    ("americas","USA","Wyoming","Grand Teton NP","Jenny Lake","place","Turquoise glacial lake with Cathedral Group reflection; ferry to Hidden Falls"),

    # ── AMERICAS — USA: Utah ──────────────────────────────────────────────────
    ("americas","USA","Utah","Arches NP","Delicate Arch Hike","place","1.5-mile climb to iconic freestanding arch; sunset light turns it amber"),
    ("americas","USA","Utah","Zion NP","Zion Scenic Drives & Trails","place","Pa'rus Trail and shuttle scenic drive; Angels Landing requires permit"),
    ("americas","USA","Utah","Bryce Canyon NP","Bryce Amphitheater Rim Trail","place","Hoodoo forest at sunrise; Pink Cliffs glow in the first light"),
    ("americas","USA","Utah","Capitol Reef NP","Capitol Reef Orchards & Waterpocket Fold","place","Pick fruit in season from pioneer orchards; dramatic monocline geology"),
    ("americas","USA","Utah","Canyonlands NP","Island in the Sky","place","Sweeping canyon overlooks 1,000 ft above the Colorado and Green rivers"),

    # ── AMERICAS — USA: New Mexico ────────────────────────────────────────────
    ("americas","USA","New Mexico","Santa Fe","La Fonda Hotel Bell Tower Bar","place","Rooftop sunset bar; views over adobe rooftops to the Sangre de Cristo Mountains"),
    ("americas","USA","New Mexico","Santa Fe","Kakawa Chocolate House","food","Aztec chile hot chocolate and historic drinking chocolate recipes since 2006"),
    ("americas","USA","New Mexico","Santa Fe","Meow Wolf","place","Immersive art installation in a converted bowling alley; otherworldly psychedelic rooms"),
    ("americas","USA","New Mexico","Santa Fe","Georgia O'Keeffe Museum","place","Largest collection of her work; haunting desert landscapes and flower paintings"),
    ("americas","USA","New Mexico","Santa Fe","Modern General","food","Stylish general store and cafe; excellent coffee, provisions, and New Mexican pantry"),
    ("americas","USA","New Mexico","Santa Fe","Tia Sophia","food","Classic New Mexican breakfast burrito with green or red chile since 1975"),
    ("americas","USA","New Mexico","Santa Fe","Santa Fe Farmers Market","place","Year-round Saturday market at the Railyard; local produce, crafts, and food"),
    ("americas","USA","New Mexico","Santa Fe","Optunia Cafe","food","Beloved neighborhood cafe with vegetarian-friendly New Mexican menu"),
    ("americas","USA","New Mexico","Santa Fe","Zaclatlan","food","Mexican brunch spot with seasonal menu and strong coffee"),
    ("americas","USA","New Mexico","Albuquerque","Sawmill Market","food","Food hall in a restored sawmill with 20+ vendors; lively on weekends"),
    ("americas","USA","New Mexico","Albuquerque","Duran's Pharmacy","food","Old-school diner famous for red chile and homestyle New Mexican plates"),
    ("americas","USA","New Mexico","Albuquerque","Tablao Flamenco & Tapas","place","Live flamenco dinner shows in an intimate venue"),
    ("americas","USA","New Mexico","Albuquerque","Rail Yards Market","place","Sunday market May–October in historic rail yards; local food and art"),
    ("americas","USA","New Mexico","Albuquerque","Rio Grande Nature Center","place","Peaceful riverside bosque with bird blinds; sandhill cranes in winter"),
    ("americas","USA","New Mexico","Albuquerque","Campos at Los Poblanos","food","Farm brunch on a lavender farm; locally-milled grains and organic produce"),
    ("americas","USA","New Mexico","Albuquerque","Sandia Peak Tramway","place","Longest aerial tram in North America; summit views at 10,378 ft"),
    ("americas","USA","New Mexico","Albuquerque","Zendo Coffee","food","Specialty coffee in Barelas neighborhood; quiet and beautifully designed"),
    ("americas","USA","New Mexico","Albuquerque","Hotel Chaco Rooftop","food","Rooftop bar with Sandia Mountain views; craft cocktails and small plates"),
    ("americas","USA","New Mexico","White Sands","White Sands National Park","place","Gypsum dune field glows brilliant white; sunset hike on the backcountry trail"),
    ("americas","USA","New Mexico","Taos","Taos Pueblo","place","UNESCO adobe village continuously inhabited for over 1,000 years"),
    ("americas","USA","New Mexico","Las Cruces","Las Cruces","place","Gateway to White Sands; Mesilla Plaza and green chile farm country"),

    # ── AMERICAS — USA: Missouri / Arkansas ───────────────────────────────────
    ("americas","USA","Missouri","St. Louis","Gateway Arch","place","Tram ride inside the 630-ft stainless arch; sunset views over the Mississippi"),
    ("americas","USA","Missouri","St. Louis","Cathedral Basilica Mosaics","place","World's largest mosaic collection; 41 million pieces of tesserae"),
    ("americas","USA","Missouri","St. Louis","Forest Park","place","Larger than Central Park; free museums, art, and green space"),
    ("americas","USA","Missouri","St. Louis","J's Pitaria","food","Middle Eastern street food with fresh pita; vegetarian-friendly options"),
    ("americas","USA","Missouri","St. Louis","Balkan Treat Box","food","Bosnian burek and cevapi; must-visit for Eastern European flavors"),
    ("americas","USA","Missouri","St. Louis","Khanna's Desi Vibes","food","Indian street food and chaat in a casual, lively setting"),
    ("americas","USA","Missouri","St. Louis","St. Louis Art Museum","place","Free museum in Forest Park; strong Impressionist and Pre-Columbian collections"),
    ("americas","USA","Missouri","St. Louis","Soulard Market","place","Oldest farmers market west of the Mississippi; Saturday mornings year-round"),
    ("americas","USA","Missouri","St. Louis","City Museum","place","Wild multi-story playscape in a converted factory; slides, caves, rooftop Ferris wheel"),
    ("americas","USA","Missouri","St. Louis","Nathaniel Reid Bakery","food","Award-winning pastry chef; croissants, kouign-amann, and seasonal tarts"),
    ("americas","USA","Missouri","St. Louis","Union Loafers Bread & Pizza","food","Wood-fired sourdough pizza and naturally-leavened bread"),
    ("americas","USA","Missouri","St. Louis","Missouri Botanical Gardens","place","One of America's finest gardens; Climatron geodesic dome greenhouse"),
    ("americas","USA","Missouri","St. Louis","Vicia Restaurant","food","Vegetable-forward fine dining from a James Beard nominated chef"),
    ("americas","USA","Missouri","St. Louis","Kaldi's Coffee Roastery","food","St. Louis staple roastery with tours and exceptional pour-overs"),
    ("americas","USA","Missouri","St. Louis","City Foundry Food Hall","food","Adaptive reuse food hall with 20+ vendors in a former iron foundry"),
    ("americas","USA","Missouri","St. Louis","Tower Grove Park","place","Victorian-era park with pavilions, fruit trees, and summer Shakespeare festival"),
    ("americas","USA","Missouri","St. Louis","Castlewood State Park","place","Lone Wolf Trail and River Scene Trail with views of the Meramec River"),
    ("americas","USA","Missouri","St. Louis","Gramaphone Sandwich Shop","food","Creative sandwiches and a beloved neighborhood gathering spot"),
    ("americas","USA","Arkansas","Bentonville","Crystal Bridges Museum of American Art","place","Free world-class art museum in the Ozark forest; founded by Alice Walton"),
    ("americas","USA","Arkansas","Bentonville","The Momentary","place","Free contemporary art space with performance, film, and rotating exhibitions"),
    ("americas","USA","Arkansas","Bentonville","Onyx Coffee Lab","food","Award-winning specialty coffee; flagship roastery and cafe in Bentonville"),
    ("americas","USA","Arkansas","Bentonville","21c Museum Hotel","place","Art hotel with free gallery; contemporary installations throughout the building"),
    ("americas","USA","Arkansas","Bentonville","Walmart Museum","place","Free history of Walmart and the Walton family in Sam Walton's original store"),
    ("americas","USA","Arkansas","Eureka Springs","Eureka Springs","place","Victorian spa town with art galleries, quirky shops, and the historic Crescent Hotel"),

    # ── AMERICAS — Canada ─────────────────────────────────────────────────────
    ("americas","Canada","Alberta","Banff","Lake Louise","place","Iconic turquoise lake backed by Victoria Glacier; canoe in summer, ice skate in winter"),
    ("americas","Canada","Alberta","Banff","Moraine Lake","place","Ten Peaks reflection; arrive before 6am to avoid road closure at peak season"),
    ("americas","Canada","Alberta","Jasper","Icefields Parkway Drive","place","240km road past the Athabasca Glacier, turquoise lakes, and wildlife"),
    ("americas","Canada","Alberta","Jasper","Peyto Lake Overlook","place","Wolf-shaped turquoise lake at Bow Summit — most photographed Icefields Parkway stop"),

    # ── AMERICAS — Latin America & Caribbean ─────────────────────────────────
    ("americas","Trinidad and Tobago","","Port of Spain","Port of Spain Carnival","place","World's greatest street party; masquerade bands and soca music in February"),
    ("americas","Trinidad and Tobago","","Caroni","Caroni Swamp Ibis Tour","place","Evening boat tour to see thousands of scarlet ibis return to roost at dusk"),
    ("americas","Trinidad and Tobago","","Asa Wright","Asa Wright Nature Centre","place","Renowned birding lodge in the rainforest; 170+ species including oilbirds"),
    ("americas","Trinidad and Tobago","","General","Indo-Caribbean Food","food","Doubles, roti, and dhal puri — T&T's Indian-inflected street food scene"),
    ("americas","Argentina","","Puerto Iguazú","Iguazú Falls","place","Wider than Niagara, taller than Victoria; see both Argentine and Brazilian sides"),
    ("americas","Argentina","","El Calafate","Perito Moreno Glacier","place","Massive advancing glacier; watch ice towers calve into the milky Argentino Lake"),
    ("americas","Argentina","","Salta","Quebrada de Humahuaca","place","UNESCO valley of polychrome mountains and pre-Columbian Incan ruins"),
    ("americas","Argentina","","Cafayate","Cafayate High-Altitude Vineyards","food","Torrontés and Malbec at 1,700m; taste at Bodega El Esteco or Colomé"),
    ("americas","Mexico","","Mexico City","Cocktail Bar Scene","food","Handcraft cocktails at Licorería Limantour; Parker & Lenox; Xaman bar"),
    ("americas","Mexico","","Mexico City","Luis Barragán Architecture","place","Modernist color and light; Casa Luis Barragán by appointment in Tacubaya"),
    ("americas","Mexico","","Mexico City","Street Taco Crawl","food","Tacos al pastor at El Huequito; birria at Taqueria Los Cocuyos"),
    ("americas","Mexico","","Xilitla","Las Pozas Surrealist Garden","place","Edward James' concrete jungle fantasyland in the cloud forest; 36 surrealist structures"),

    # ── EUROPE — Portugal & Spain Islands ─────────────────────────────────────
    ("europe","Portugal","","Sete Cidades","Sete Cidades Twin Lakes","place","Collapsed caldera with a blue lake and a green lake side by side; Vista do Rei viewpoint"),
    ("europe","Portugal","","Furnas","Furnas Hot Springs & Botanical Gardens","place","Thermal calderas and cozido das Furnas stew cooked underground in volcanic steam"),
    ("europe","Portugal","","Furnas","Cozido das Furnas","food","Meat and vegetable stew cooked underground by volcanic steam; try at Tony's restaurant"),
    ("europe","Portugal","","Funchal","Funchal Mercado dos Lavradores","place","Art Deco flower and fruit market; exotic produce stalls and azulejo tile panels"),
    ("europe","Portugal","","Pico do Arieiro","Pico do Arieiro to Ruivo Hike","place","Ridge hike between Madeira's highest peaks; above cloud layer at dawn"),
    ("europe","Portugal","","General","Levada Walks","place","200 miles of irrigation channel trails; easy gradient through lush laurisilva scenery"),
    ("europe","Portugal","","Funchal","Blandy's Wine Lodge","food","Madeira wine tasting in a 200-year-old lodge; guided cellar tour with vintage Sercial"),
    ("europe","Spain","","Teide","Teide National Park","place","Lunar landscape around Spain's highest peak; cable car to near summit at 3,555m"),
    ("europe","Spain","","La Laguna","La Laguna UNESCO Old Town","place","16th-century colonial grid; colorful facades, tapas bars, and university atmosphere"),
    ("europe","Spain","","La Gomera","Garajonay National Park","place","Primeval laurel forest; listen for the Silbo Gomero whistling language demonstrations"),
    # Portugal Mainland
    ("europe","Portugal","","Porto","Ribeira Riverside & Livraria Lello","place","Medieval riverfront and neo-Gothic bookshop that inspired Harry Potter"),
    ("europe","Portugal","","Porto","Douro Valley Vineyard Stay","food","Port tasting at Quinta do Crasto, Graham's, or Quinta da Pacheca; sunset over terraced vines"),
    ("europe","Portugal","","Porto","Fado Performance","place","Intimate fado houses in Miragaia or Bairro Alto; melancholic Portuguese song"),
    ("europe","Portugal","","Évora","Évora & Monsaraz","place","UNESCO walled Roman city; megalithic temples, cork forests, and Cromeleque dos Almendres"),
    # France
    ("europe","France","","Valensole","Lavender Fields of Valensole","place","Peak bloom late June to mid-July; arrive early morning for best light and photos"),
    ("europe","France","","Luberon","Luberon Villages","place","Gordes, Roussillon, and Bonnieux perched on hilltops with Provençal views"),
    ("europe","France","","Arles","Roman Ruins in Arles & Nîmes","place","Roman amphitheater, thermal baths, and arena; Van Gogh's favorite Provençal town"),
    ("europe","France","","Aix-en-Provence","Aix-en-Provence Markets","place","Cours Mirabeau morning markets; fresh produce, flowers, and local crafts"),
    ("europe","France","","Bordeaux","Bordeaux Vineyard Tours & Cité du Vin","food","Right Bank châteaux visits and the spectacular Cité du Vin wine museum"),
    ("europe","France","","French Riviera","Moyenne Corniche Drive & Nice","place","Dramatic cliff road between Nice and Monaco; Antibes old town and Cap Ferrat"),

    # ── EUROPE — Italy (from Italy.pdf + Bucket List) ──────────────────────────
    ("europe","Italy","","Assisi","Assisi","place","Hilltop medieval town; Basilica of St. Francis with Giotto's celebrated fresco cycle"),
    ("europe","Italy","","Orvieto","Orvieto","place","Cathedral facade mosaics and underground Etruscan tunnels; Orvieto Classico wine"),
    ("europe","Italy","","Verona","Verona & Torbole","place","Roman arena, Juliet's balcony, and wine bars; day trip to Lake Garda at Torbole"),
    ("europe","Italy","","Civita di Bagnoregio","Civita di Bagnoregio","place","'Dying city' on a tufa plateau; connected by a single pedestrian bridge"),
    ("europe","Italy","","Perugia","Perugia","place","Umbrian capital with excellent chocolate festival in October; underground Etruscan city"),
    ("europe","Italy","","Lucca","Lucca & Pisa","place","Lucca's intact Renaissance walls for cycling; Pisa's cathedral square beyond the tower"),
    ("europe","Italy","","Matera","Matera Sassi","place","Cave dwellings carved into ravines; one of Europe's oldest continuously inhabited cities"),
    ("europe","Italy","","Castelmezzano","Castelmezzano","place","Vertical village clinging to Dolomiti Lucane peaks; Flight of the Angel zip line"),
    ("europe","Italy","","Milan","Milan Duomo & Brera District","place","Rooftop walk on the Gothic Duomo; Last Supper (book months ahead); Brera design quarter"),
    ("europe","Italy","","Milan","Vigevano","place","Perfectly preserved Renaissance piazza 35km from Milan; the Sforzesco castle and duomo"),
    ("europe","Italy","","Genoa","Genoa Pesto & Caruggi Lanes","food","Birthplace of pesto; eat trofie al pesto in the medieval alleyways (caruggi) of the old port"),
    ("europe","Italy","","Genoa","Camogli & Santa Margherita","place","Portofino coast: colorful Camogli and glamorous Santa Margherita with ferry to Portofino"),
    ("europe","Italy","","Siena","Siena","place","Gothic cathedral, Piazza del Campo, and Palio horse race in July and August"),
    ("europe","Italy","","Modena","Modena","food","Home of Massimo Bottura's Osteria Francescana; traditional balsamic vinegar and tortellini"),
    ("europe","Italy","","Ravenna","Ravenna Byzantine Mosaics","place","Six UNESCO buildings with the finest Byzantine mosaics in the world; unmissable"),
    ("europe","Italy","","Florence","Boboli Gardens","place","Medici garden behind Palazzo Pitti; fountains, grottos, and city views from the top"),
    ("europe","Italy","","Arezzo","Arezzo","place","Piero della Francesca frescoes, antique market on the first Sunday, and medieval jousting"),
    ("europe","Italy","","Anghiari","Anghiari","place","Renaissance hilltop village; site of Leonardo's famous lost Battle of Anghiari fresco"),
    ("europe","Italy","","Cortona","Cortona","place","Under the Tuscan Sun town; Etruscan walls, the MAEC museum, and San Domenico church"),
    ("europe","Italy","","Rome","Two Sizes Tiramisu Bar","food","Legendary tiramisu in a tiny shop near Campo de' Fiori; always get the large"),
    ("europe","Italy","","Rome","Chiesa del Gesù","place","Mother church of the Jesuits; trompe-l'oeil ceiling fresco that will stop you in your tracks"),
    ("europe","Italy","","Rome","Jerry Thomas Cocktail Bar","food","Speakeasy-style craft cocktails in a basement off Via della Croce; ring the bell"),
    ("europe","Italy","","Rome","Pizzeria Da Remo","food","Classic Roman thin-crust pizza in Testaccio; arrive before 7pm or expect a long queue"),
    ("europe","Italy","","Rome","Pincio Gardens Sunset","place","Terrace overlook of Piazza del Popolo and all of Rome; golden hour is spectacular"),
    ("europe","Italy","","Tivoli","Villa d'Este Gardens","place","UNESCO Renaissance gardens with 500 fountains; 30km from Rome; go on weekdays"),
    ("europe","Italy","","Dolomites","Seceda Ridgeline & Tre Cime Circuit","place","Seceda's jagged odle peaks from Ortisei gondola; Tre Cime di Lavaredo circuit in Sexten"),
    ("europe","Italy","","Franciacorta","Franciacorta Sparkling Wine Estates","food","Metodo classico sparkling wine between Brescia and Lake Iseo; Ca' del Bosco, Bellavista"),
    ("europe","Italy","","Langhe","Barolo & Barbaresco Wineries","food","Piedmont wine country; cellar visits at Vietti, Bruno Giacosa, and Giacomo Conterno"),

    # ── EUROPE — UK & Ireland ─────────────────────────────────────────────────
    ("europe","United Kingdom","England","London","London Museums & Food Markets","place","British Museum, Borough Market, V&A, and Tate Modern; day in the South Bank"),
    ("europe","United Kingdom","England","Oxford","Oxford & Cambridge","place","College tours, punting on the Cherwell and Cam, Bodleian Library, botanical gardens"),
    ("europe","United Kingdom","England","Cotswolds","Cotswolds Villages","place","Bourton-on-the-Water, Burford, and Bibury; quintessential English countryside"),
    ("europe","United Kingdom","Scotland","Scottish Highlands","Scottish Highlands","place","Glencoe, Loch Ness, Isle of Skye Fairy Pools, and Eilean Donan Castle"),
    ("europe","United Kingdom","Scotland","Edinburgh","Edinburgh","place","Castle, Royal Mile, Arthur's Seat hike, and Scotch whisky tastings"),
    ("europe","Ireland","","Dublin","Dublin Castles & Pubs","place","Trinity College Book of Kells, Dublin Castle, and a proper Georgian pub crawl"),

    # ── EUROPE — Nordics ──────────────────────────────────────────────────────
    ("europe","Norway","","Geiranger","Geirangerfjord","place","UNESCO fjord with Seven Sisters waterfall; kayak or cruise May–September"),
    ("europe","Norway","","Lofoten","Lofoten Islands","place","Dramatic peaks rising from the sea; rorbuer fishing cabins and midnight sun in summer"),
    ("europe","Norway","","Bergen","Bergen Bryggen Wharf","place","Colorful Hanseatic wooden warehouses; fish market and funicular to Mount Fløyen"),
    ("europe","Norway","","Oslo","Oslo Culture & Museums","place","Viking Ship Museum, Vigeland Sculpture Park, and the Aker Brygge waterfront"),
    ("europe","Sweden","","Stockholm","Vasa Museum & Gamla Stan","place","Perfectly preserved 17th-century warship; then cobblestone old town walks and meatballs"),
    ("europe","Finland","","Helsinki","Helsinki Design District","place","Design Museum, Aalto-designed spaces, Eira café culture, and Hakaniemi Market"),

    # ── EUROPE — Christmas Markets ─────────────────────────────────────────────
    ("europe","Belgium","","Bruges","Bruges Christmas Market","place","Medieval canal town with lace shops and chocolate; magical atmosphere at Christmas"),
    ("europe","Germany","","Cologne","Cologne Cathedral Christmas Market","place","Cathedral backdrop makes this Germany's most dramatic Christmas market"),
    ("europe","Austria","","Vienna","Vienna Christmas Markets","place","Rathausplatz and Schönbrunn markets; glühwein, Sachertorte, and classical concerts"),
    ("europe","Germany","","Rothenburg ob der Tauber","Rothenburg Christmas Market","place","Fairytale walled town; Käthe Wohlfahrt Christmas store and torchlit evening markets"),
    ("europe","Austria","","Hallstatt","Hallstatt Winter","place","Alpine village reflected in lake; Christmas charm; arrive early morning to beat day-trippers"),
    ("europe","France","","Strasbourg","Strasbourg Christkindelsmärik","place","France's oldest Christmas market (since 1570); mulled wine and bredele spiced cookies"),
]

if __name__ == "__main__":
    print(f"Importing {len(PLACES)} places into Firestore...\n")
    for p in PLACES:
        add(*p)
    print(f"\nDone. {added} added, {errors} errors.")
