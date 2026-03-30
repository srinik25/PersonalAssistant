#!/usr/bin/env python3
"""Import Mexico City places from PDF into Firestore."""
import requests, time
from datetime import datetime, timezone

PROJECT = "nutrition-198dd"
URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/travel_places"
added = errors = 0

def add(name, type_, desc="", city="Mexico City"):
    global added, errors
    doc = {"fields": {
        "continent":   {"stringValue": "americas"},
        "country":     {"stringValue": "Mexico"},
        "state":       {"stringValue": ""},
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

# Mexico City — 94 items classified by type
# place = landmark/museum/architecture | food = restaurant/cafe/bar/bakery | experience = tour/class/event

PLACES = [
    # ── LANDMARKS & MUSEUMS ───────────────────────────────────────────────────
    ("Biblioteca Vasconcelos", "place", "Stunning post-modern library with stacked bookshelves and a whale skeleton sculpture; free entry"),
    ("Luis Barragán House & Studio", "place", "UNESCO-listed brutalist color masterpiece in Tacubaya; book tickets well in advance"),
    ("Archivo Diseño y Arquitectura", "place", "Design museum in a house near Barragán; changing exhibitions on architecture and objects"),
    ("Centro de la Imagen Photography Museum", "place", "Photography museum in a former customs building in Centro; free entry"),
    ("Monumento a la Revolución", "place", "Art Deco dome with a museum inside and panoramic elevator to the top; on Reforma"),
    ("Cineteca Nacional", "place", "Premier arthouse cinema complex with outdoor screens and a great café"),
    ("Museo de Arte Popular", "place", "Stunning collection of folk art and crafts from all Mexican states; must-visit"),
    ("Catedral Metropolitana Climb", "place", "Rooftop climb of the baroque cathedral overlooking the Zócalo; go in the morning"),
    ("Museo Rufino Tamayo", "place", "World-class contemporary art museum in Chapultepec park donated by Tamayo himself"),
    ("UNAM Campus & MUAC Museum", "place", "Mosaic-covered Olympic stadium and the MUAC contemporary art museum; free campus walk"),
    ("Secretaría de Educación Pública", "place", "Diego Rivera's most ambitious mural cycle — 235 panels across three courtyards; free entry"),
    ("Palacio de Correos de México", "place", "Beaux-Arts postal palace with an ornate interior; free to enter the lobby"),
    ("Torre Latinoamericana", "place", "1950s skyscraper with an observation deck; sunset views over the entire city"),
    ("Museo del Calzado El Borceguí", "place", "Quirky shoe museum above one of Mexico City's oldest shoe stores; free entry"),
    ("Museo de Geología UNAM", "place", "Beautiful 1906 building with paleontology and mineral collections; free entry"),
    ("Chocolate Museum", "place", "Interactive chocolate museum near Centro; good for a rainy afternoon"),
    ("Mexico City Zoo (Chapultepec)", "place", "Free zoo inside Bosque de Chapultepec with giant pandas; popular with families"),
    ("Kurimanzutto Gallery", "place", "Leading contemporary art gallery in San Miguel Chapultepec; blue-chip Mexican artists"),
    ("Casa Orgánica", "place", "Javier Senosiain's organic architecture house in Naucalpan; curved biomorphic forms"),
    ("Squash 73 Event Space", "place", "Converted squash club turned arts and events venue in Colonia Juárez"),
    ("Utilitario Mexicano", "place", "Curated kitchen and home goods shop celebrating Mexican industrial design; great gifts"),
    ("Cafebrería El Péndulo", "place", "Books, plants, jazz, and excellent coffee across multiple floors; stay for hours"),
    ("Supra Roma Rooftop Sunset", "place", "Rooftop bar in Colonia Roma with views over the neighborhood at golden hour"),
    ("Carlotta Reforma Skybar Ritz", "place", "Rooftop pool and bar at the Ritz-Carlton; stunning views along Paseo de la Reforma"),
    ("Hotel Carlota", "place", "Boutique hotel in Cuauhtémoc with a beautiful courtyard pool and design-forward spaces"),
    # ── EXPERIENCES ───────────────────────────────────────────────────────────
    ("Mixquic Day of the Dead", "experience", "Traditional Día de Muertos celebrations in the small town of Mixquic south of CDMX; November 1–2", "Mixquic"),
    ("Free Walking Tour CDMX", "experience", "Daily free walking tours of Centro Histórico and other neighborhoods; tip-based"),
    ("Mexico City Greeters", "experience", "Free local volunteer guides who show you their neighborhood; book at gob.mx/turismo"),
    ("Casa Jacaranda Cooking Class", "experience", "Market visit and hands-on cooking class in a beautiful Roma Norte home"),
    # ── FOOD: VEGAN & VEGETARIAN ──────────────────────────────────────────────
    ("La Pitahaya", "food", "Beloved vegan restaurant with creative Mexican dishes; long-running Roma Norte staple"),
    ("Annie Veggie", "food", "Vegan weekend pop-up; check Instagram for location — worth tracking down"),
    ("Los Loosers", "food", "Veg-forward spot with a legendary taco sampler and Japanese-Mexican ramen"),
    ("Veguismo", "food", "Plant-based Mexican food done right; comida corrida and daily specials"),
    ("Raiz", "food", "Elegant vegetable-forward menu; the roasted beet salad is the signature"),
    ("Resi", "food", "Small-plates restaurant with an excellent chile relleno trio"),
    ("Pan D'monium", "food", "Vegan burger spot that satisfies even the most committed carnivores"),
    ("Ambaba Vegan Cafe", "food", "Casual neighborhood vegan café with smoothie bowls and daily specials"),
    ("Vegamo", "food", "Vegan restaurant with standout mole enchiladas; Condesa location"),
    ("Masala y Maiz", "food", "Indian-Mexican fusion by Norma Listman; corn tortillas meet South Asian spice"),
    ("Maizajo", "food", "Nixtamal tortillería and restaurant celebrating heirloom Mexican corn varieties"),
    ("El Expendio de Maiz", "food", "Standing-room tortillería in Roma serving fresh-made tortillas with simple toppings"),
    ("Expendio di Maiz Sin Nombre", "food", "No-name corn shop in Tepito serving the most authentic tortillas in the city"),
    ("La Ventana", "food", "Simple spot known for fried plantain dishes and traditional antojitos"),
    # ── FOOD: FINE DINING & ACCLAIMED ────────────────────────────────────────
    ("Pujol", "food", "Enrique Olvera's flagship; the mole madre aged 1,000+ days is unmissable; book months ahead"),
    ("Quintonil", "food", "Jorge Vallejo's contemporary Mexican tasting menu; native ingredients and brilliant technique"),
    ("Lalo", "food", "Breakfast and brunch institution in Roma; avocado toast before it was cool"),
    ("Nicos", "food", "Classic family-run Mexican restaurant open since 1957; a pilgrimage for traditional dishes"),
    ("Contramar Fish", "food", "The definitive Mexico City seafood lunch spot; tuna tostadas and the half-red half-green fish"),
    ("Rosetta", "food", "Elena Reygadas' Italian-inflected restaurant in a Roma mansion; sourdough and guava pastry"),
    ("Lardo", "food", "All-day café and restaurant from Elena Reygadas; excellent pastries and light Italian food"),
    ("San Angel Inn", "food", "Romantic hacienda restaurant in a 17th-century convent; traditional Mexican cuisine"),
    ("Molino El Pujol", "food", "Pujol's tortillería and corn-focused casual restaurant; tortillas, tetelas, and atole"),
    ("Pasilla de Humo", "food", "Oaxacan restaurant specializing in molestos istemenos, plantain dishes, and papaya salad"),
    ("Guizina Oaxaca", "food", "Oaxacan food in the city; tlayudas, mole negro, and mezcal cocktails"),
    ("Zanaya Mexico City", "food", "Modern seafood restaurant at the Four Seasons; wood-fired fish and ceviche"),
    ("Rosa Negra", "food", "Buzzy Latin American restaurant popular with the Polanco crowd; good ceviche and cocktails"),
    ("Los Danzantes", "food", "Coyoacán restaurant with a strong mezcal program and Oaxacan-inspired dishes"),
    ("Tata Mezcalería", "food", "Mezcal bar with a cocina de autor menu; intimate and serious about agave spirits"),
    ("Blanco Colima", "food", "Bright all-day café in Roma Norte; excellent eggs, pastries, and natural wines"),
    ("Mandolina", "food", "Mediterranean-inflected restaurant; good for a leisurely lunch in Condesa"),
    ("Parole iTALIAN", "food", "Italian restaurant popular with local residents; fresh pasta and thin-crust pizza"),
    ("Sofitel Balta", "food", "The Sofitel Mexico's rooftop restaurant with sweeping city views and good cocktails"),
    ("Citizen Bar", "food", "Stylish cocktail bar in Roma; strong mezcal and tequila program"),
    # ── FOOD: CASUAL, TACOS & STREET ─────────────────────────────────────────
    ("Cancino Pizza", "food", "Wood-fired Neapolitan-style pizza in an open courtyard; Colonia Roma institution"),
    ("La Chicha", "food", "Wild mushroom tacos — some of the best in the city; small spot in Roma Norte"),
    ("Tlaco", "food", "Tiny taco stand with creative fillings and natural wines; cult following"),
    ("Gatorta", "food", "Famous torta stall; crusty telera rolls packed with beans, avocado, and cheese"),
    ("Tamales Madre", "food", "Artisanal tamales with creative fillings; vegan and traditional options"),
    ("Eno Lonchería", "food", "Rustic lonchería with comida corrida; best value lunch in Colonia Centro"),
    ("Jarilla", "food", "Creative sandwiches on house-baked bread; neighbourhood lunch spot in Colonia Roma"),
    ("Maque", "food", "Beloved breakfast and brunch spot; pastries, eggs, and excellent coffee"),
    # ── FOOD: CAFES & BAKERIES ────────────────────────────────────────────────
    ("Niddo Coffee Shop", "food", "Airy plant-filled specialty coffee shop; one of CDMX's most instagrammable cafes"),
    ("Blend Station Cafe", "food", "Specialty café with a giant tree growing through the ceiling in Colonia Roma"),
    ("Cafe Milou", "food", "French-inflected café in Polanco; croissants and café au lait in a Parisian setting"),
    ("Bou Bakery", "food", "Natural-leavened sourdough and Scandinavian-inspired pastries; small and lovely"),
    ("Madre Cafe", "food", "Specialty coffee with a strong plant-based food menu; multiple Roma locations"),
    ("Dosis Cafe", "food", "Friendly neighborhood café with excellent single-origin espresso drinks"),
    ("Cafe Currado", "food", "Quiet specialty café in Condesa; a good place to work and drink good coffee"),
    ("Pastelería Ideal", "food", "Old-school bakery in Centro with hundreds of pan dulce varieties; open since 1927"),
    # ── FOOD: SWEETS & ICE CREAM ─────────────────────────────────────────────
    ("El Moro Churrería", "food", "Open since 1935; churros with thick hot chocolate; the Centro location never closes"),
    ("Helados Gibran", "food", "Artisanal ice cream in unusual Mexican flavors; Coyoacán and Roma locations"),
    ("Le Especial de Paris Ice Cream", "food", "Classic ice cream parlor on Insurgentes; French-style glacé since 1921"),
    ("Nevería Roxy Ice Cream", "food", "Old-school nevería in Colonia Roma serving paletas and creamy ice creams since 1946"),
    ("Los Ponchos Flan", "food", "Famous stand serving silky Mexican flan; worth the short wait"),
    ("Joe Gelato", "food", "Italian-style gelato with Mexican flavors like cajeta and tamarind"),
    ("Cafe Nin", "food", "Breakfast-focused café with excellent chilaquiles and pastries; Roma Norte"),
]

if __name__ == "__main__":
    print(f"Importing {len(PLACES)} Mexico City places...\n")
    for p in PLACES:
        add(*p)
    print(f"\nDone. {added} added, {errors} errors.")
