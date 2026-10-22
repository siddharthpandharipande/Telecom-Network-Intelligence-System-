"""Geolocation and reverse spatial resolution utilities for NEXUSNET.

Maps GPS coordinates (latitude, longitude) to the accurate telecom hub,
city, country, continent, and region, allowing operator telemetry to be
located automatically on the network map and queried in the network health dashboard.
Supports real-world OpenStreetMap Nominatim reverse geocoding with fast offline fallback.
"""
from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

# Country normalization dictionary
COUNTRY_NORMALIZATION: Dict[str, str] = {
    "norge": "Norway",
    "norway": "Norway",
    "sverige": "Sweden",
    "sweden": "Sweden",
    "suomi": "Finland",
    "finland": "Finland",
    "danmark": "Denmark",
    "denmark": "Denmark",
    "ísland": "Iceland",
    "island": "Iceland",
    "iceland": "Iceland",
    "deutschland": "Germany",
    "germany": "Germany",
    "france": "France",
    "united kingdom": "UK",
    "great britain": "UK",
    "england": "England",
    "scotland": "UK",
    "wales": "UK",
    "northern ireland": "UK",
    "italia": "Italy",
    "italy": "Italy",
    "españa": "Spain",
    "spain": "Spain",
    "nederland": "Netherlands",
    "the netherlands": "Netherlands",
    "netherlands": "Netherlands",
    "belgië": "Belgium",
    "belgique": "Belgium",
    "belgium": "Belgium",
    "schweiz": "Switzerland",
    "suisse": "Switzerland",
    "svizzera": "Switzerland",
    "switzerland": "Switzerland",
    "österreich": "Austria",
    "austria": "Austria",
    "polska": "Poland",
    "poland": "Poland",
    "ireland": "Ireland",
    "éire": "Ireland",
    "portugal": "Portugal",
    "ellada": "Greece",
    "greece": "Greece",
    "türkiye": "Turkey",
    "turkey": "Turkey",
    "united states": "USA",
    "united states of america": "USA",
    "usa": "USA",
    "us": "USA",
    "canada": "Canada",
    "méxico": "Mexico",
    "mexico": "Mexico",
    "brasil": "Brazil",
    "brazil": "Brazil",
    "argentina": "Argentina",
    "colombia": "Colombia",
    "chile": "Chile",
    "perú": "Peru",
    "peru": "Peru",
    "india": "India",
    "bharat": "India",
    "china": "China",
    "japan": "Japan",
    "nippon": "Japan",
    "south korea": "South Korea",
    "republic of korea": "South Korea",
    "korea": "South Korea",
    "singapore": "Singapore",
    "thailand": "Thailand",
    "indonesia": "Indonesia",
    "malaysia": "Malaysia",
    "philippines": "Philippines",
    "vietnam": "Vietnam",
    "united arab emirates": "UAE",
    "uae": "UAE",
    "saudi arabia": "Saudi Arabia",
    "qatar": "Qatar",
    "egypt": "Egypt",
    "south africa": "South Africa",
    "nigeria": "Nigeria",
    "kenya": "Kenya",
    "morocco": "Morocco",
    "ghana": "Ghana",
    "australia": "Australia",
    "new zealand": "New Zealand",
    "aotearoa": "New Zealand",
}

# In-memory LRU cache for geocoding lookups
_GEO_CACHE: Dict[str, Dict[str, Any]] = {}

# Comprehensive reference centroids for global metropolitan telecom hubs across all 6 continents
REFERENCE_LOCATIONS: List[Dict[str, Any]] = [
    # Europe - Scandinavia & Nordics
    {"continent": "Europe", "country": "Norway", "city": "Tromsø", "region": "Troms og Finnmark", "lat": 69.6496, "lng": 18.9560},
    {"continent": "Europe", "country": "Norway", "city": "Oslo", "region": "Ostlandet", "lat": 59.9139, "lng": 10.7522},
    {"continent": "Europe", "country": "Norway", "city": "Bergen", "region": "Vestland", "lat": 60.3913, "lng": 5.3221},
    {"continent": "Europe", "country": "Norway", "city": "Trondheim", "region": "Trøndelag", "lat": 63.4305, "lng": 10.3951},
    {"continent": "Europe", "country": "Sweden", "city": "Stockholm", "region": "Stockholm", "lat": 59.3293, "lng": 18.0686},
    {"continent": "Europe", "country": "Sweden", "city": "Gothenburg", "region": "Västra Götaland", "lat": 57.7089, "lng": 11.9746},
    {"continent": "Europe", "country": "Finland", "city": "Helsinki", "region": "Uusimaa", "lat": 60.1699, "lng": 24.9384},
    {"continent": "Europe", "country": "Denmark", "city": "Copenhagen", "region": "Capital Region", "lat": 55.6761, "lng": 12.5683},
    {"continent": "Europe", "country": "Iceland", "city": "Reykjavik", "region": "Capital", "lat": 64.1466, "lng": -21.9426},
    {"continent": "Europe", "country": "Iceland", "city": "Akureyri", "region": "Northeast", "lat": 65.6835, "lng": -18.0878},

    # Europe - Western & Central
    {"continent": "Europe", "country": "UK", "city": "London", "region": "Greater London", "lat": 51.5074, "lng": -0.1278},
    {"continent": "Europe", "country": "UK", "city": "Manchester", "region": "North West", "lat": 53.4808, "lng": -2.2426},
    {"continent": "Europe", "country": "UK", "city": "Edinburgh", "region": "Scotland", "lat": 55.9533, "lng": -3.1883},
    {"continent": "Europe", "country": "France", "city": "Paris", "region": "Ile-de-France", "lat": 48.8566, "lng": 2.3522},
    {"continent": "Europe", "country": "France", "city": "Marseille", "region": "Provence-Alpes-Cote d'Azur", "lat": 43.2965, "lng": 5.3698},
    {"continent": "Europe", "country": "France", "city": "Lyon", "region": "Auvergne-Rhone-Alpes", "lat": 45.7640, "lng": 4.8357},
    {"continent": "Europe", "country": "Germany", "city": "Berlin", "region": "Berlin", "lat": 52.5200, "lng": 13.4050},
    {"continent": "Europe", "country": "Germany", "city": "Frankfurt", "region": "Hesse", "lat": 50.1109, "lng": 8.6821},
    {"continent": "Europe", "country": "Germany", "city": "Munich", "region": "Bavaria", "lat": 48.1351, "lng": 11.5820},
    {"continent": "Europe", "country": "Netherlands", "city": "Amsterdam", "region": "North Holland", "lat": 52.3676, "lng": 4.9041},
    {"continent": "Europe", "country": "Netherlands", "city": "Rotterdam", "region": "South Holland", "lat": 51.9244, "lng": 4.4777},
    {"continent": "Europe", "country": "Belgium", "city": "Brussels", "region": "Brussels-Capital", "lat": 50.8503, "lng": 4.3517},
    {"continent": "Europe", "country": "Switzerland", "city": "Zurich", "region": "Zurich", "lat": 47.3769, "lng": 8.5417},
    {"continent": "Europe", "country": "Switzerland", "city": "Geneva", "region": "Geneva", "lat": 46.2044, "lng": 6.1432},
    {"continent": "Europe", "country": "Austria", "city": "Vienna", "region": "Vienna", "lat": 48.2082, "lng": 16.3738},
    {"continent": "Europe", "country": "Ireland", "city": "Dublin", "region": "Leinster", "lat": 53.3498, "lng": -6.2603},

    # Europe - Southern & Eastern
    {"continent": "Europe", "country": "Italy", "city": "Rome", "region": "Lazio", "lat": 41.9028, "lng": 12.4964},
    {"continent": "Europe", "country": "Italy", "city": "Milan", "region": "Lombardy", "lat": 45.4642, "lng": 9.1900},
    {"continent": "Europe", "country": "Spain", "city": "Madrid", "region": "Community of Madrid", "lat": 40.4168, "lng": -3.7038},
    {"continent": "Europe", "country": "Spain", "city": "Barcelona", "region": "Catalonia", "lat": 41.3851, "lng": 2.1734},
    {"continent": "Europe", "country": "Portugal", "city": "Lisbon", "region": "Lisbon", "lat": 38.7223, "lng": -9.1393},
    {"continent": "Europe", "country": "Poland", "city": "Warsaw", "region": "Masovia", "lat": 52.2297, "lng": 21.0122},
    {"continent": "Europe", "country": "Poland", "city": "Krakow", "region": "Lesser Poland", "lat": 50.0647, "lng": 19.9450},
    {"continent": "Europe", "country": "Czechia", "city": "Prague", "region": "Prague", "lat": 50.0755, "lng": 14.4378},
    {"continent": "Europe", "country": "Greece", "city": "Athens", "region": "Attica", "lat": 37.9838, "lng": 23.7275},
    {"continent": "Europe", "country": "Turkey", "city": "Istanbul", "region": "Marmara", "lat": 41.0082, "lng": 28.9784},

    # Asia - South Asia
    {"continent": "Asia", "country": "India", "city": "Mumbai", "region": "Maharashtra", "lat": 19.0760, "lng": 72.8777},
    {"continent": "Asia", "country": "India", "city": "Delhi", "region": "Delhi", "lat": 28.6139, "lng": 77.2090},
    {"continent": "Asia", "country": "India", "city": "Pune", "region": "Maharashtra", "lat": 18.5204, "lng": 73.8567},
    {"continent": "Asia", "country": "India", "city": "Bengaluru", "region": "Karnataka", "lat": 12.9716, "lng": 77.5946},
    {"continent": "Asia", "country": "India", "city": "Hyderabad", "region": "Telangana", "lat": 17.3850, "lng": 78.4867},
    {"continent": "Asia", "country": "India", "city": "Chennai", "region": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707},
    {"continent": "Asia", "country": "India", "city": "Kolkata", "region": "West Bengal", "lat": 22.5726, "lng": 88.3639},

    # Asia - East & Southeast Asia
    {"continent": "Asia", "country": "Japan", "city": "Tokyo", "region": "Kanto", "lat": 35.6762, "lng": 139.6503},
    {"continent": "Asia", "country": "Japan", "city": "Osaka", "region": "Kansai", "lat": 34.6937, "lng": 135.5023},
    {"continent": "Asia", "country": "South Korea", "city": "Seoul", "region": "Seoul Capital", "lat": 37.5665, "lng": 126.9780},
    {"continent": "Asia", "country": "China", "city": "Shanghai", "region": "Shanghai", "lat": 31.2304, "lng": 121.4737},
    {"continent": "Asia", "country": "China", "city": "Beijing", "region": "Beijing", "lat": 39.9042, "lng": 116.4074},
    {"continent": "Asia", "country": "Singapore", "city": "Singapore", "region": "Central", "lat": 1.3521, "lng": 103.8198},
    {"continent": "Asia", "country": "Thailand", "city": "Bangkok", "region": "Bangkok", "lat": 13.7563, "lng": 100.5018},
    {"continent": "Asia", "country": "Malaysia", "city": "Kuala Lumpur", "region": "Federal Territory", "lat": 3.1390, "lng": 101.6869},
    {"continent": "Asia", "country": "Indonesia", "city": "Jakarta", "region": "DKI Jakarta", "lat": -6.2088, "lng": 106.8456},
    {"continent": "Asia", "country": "Philippines", "city": "Manila", "region": "Metro Manila", "lat": 14.5995, "lng": 120.9842},
    {"continent": "Asia", "country": "Vietnam", "city": "Hanoi", "region": "Red River Delta", "lat": 21.0285, "lng": 105.8542},

    # Asia - Middle East
    {"continent": "Asia", "country": "UAE", "city": "Dubai", "region": "Dubai", "lat": 25.2048, "lng": 55.2708},
    {"continent": "Asia", "country": "UAE", "city": "Abu Dhabi", "region": "Abu Dhabi", "lat": 24.4539, "lng": 54.3773},
    {"continent": "Asia", "country": "Saudi Arabia", "city": "Riyadh", "region": "Riyadh", "lat": 24.7136, "lng": 46.6753},
    {"continent": "Asia", "country": "Qatar", "city": "Doha", "region": "Ad-Dawhah", "lat": 25.2854, "lng": 51.5310},

    # North America
    {"continent": "North America", "country": "USA", "city": "New York", "region": "New York", "lat": 40.7128, "lng": -74.0060},
    {"continent": "North America", "country": "USA", "city": "Los Angeles", "region": "California", "lat": 34.0522, "lng": -118.2437},
    {"continent": "North America", "country": "USA", "city": "Chicago", "region": "Illinois", "lat": 41.8781, "lng": -87.6298},
    {"continent": "North America", "country": "USA", "city": "San Francisco", "region": "California", "lat": 37.7749, "lng": -122.4194},
    {"continent": "North America", "country": "USA", "city": "Seattle", "region": "Washington", "lat": 47.6062, "lng": -122.3321},
    {"continent": "North America", "country": "Canada", "city": "Toronto", "region": "Ontario", "lat": 43.6532, "lng": -79.3832},
    {"continent": "North America", "country": "Canada", "city": "Vancouver", "region": "British Columbia", "lat": 49.2827, "lng": -123.1207},
    {"continent": "North America", "country": "Mexico", "city": "Mexico City", "region": "CDMX", "lat": 19.4326, "lng": -99.1332},

    # South America
    {"continent": "South America", "country": "Brazil", "city": "Sao Paulo", "region": "Sao Paulo", "lat": -23.5505, "lng": -46.6333},
    {"continent": "South America", "country": "Brazil", "city": "Rio de Janeiro", "region": "Rio de Janeiro", "lat": -22.9068, "lng": -43.1729},
    {"continent": "South America", "country": "Argentina", "city": "Buenos Aires", "region": "Buenos Aires", "lat": -34.6037, "lng": -58.3816},
    {"continent": "South America", "country": "Colombia", "city": "Bogota", "region": "Capital District", "lat": 4.7110, "lng": -74.0721},
    {"continent": "South America", "country": "Chile", "city": "Santiago", "region": "Santiago Metropolitan", "lat": -33.4489, "lng": -70.6693},
    {"continent": "South America", "country": "Peru", "city": "Lima", "region": "Lima", "lat": -12.0464, "lng": -77.0428},

    # Africa
    {"continent": "Africa", "country": "Egypt", "city": "Cairo", "region": "Cairo", "lat": 30.0444, "lng": 31.2357},
    {"continent": "Africa", "country": "South Africa", "city": "Johannesburg", "region": "Gauteng", "lat": -26.2041, "lng": 28.0473},
    {"continent": "Africa", "country": "South Africa", "city": "Cape Town", "region": "Western Cape", "lat": -33.9249, "lng": 18.4241},
    {"continent": "Africa", "country": "Kenya", "city": "Nairobi", "region": "Nairobi", "lat": -1.2921, "lng": 36.8219},
    {"continent": "Africa", "country": "Nigeria", "city": "Lagos", "region": "Lagos", "lat": 6.5244, "lng": 3.3792},
    {"continent": "Africa", "country": "Morocco", "city": "Casablanca", "region": "Casablanca-Settat", "lat": 33.5731, "lng": -7.5898},
    {"continent": "Africa", "country": "Ghana", "city": "Accra", "region": "Greater Accra", "lat": 5.6037, "lng": -0.1870},
    {"continent": "Africa", "country": "Namibia", "city": "Windhoek", "region": "Khomas", "lat": -22.5609, "lng": 17.0658},

    # Oceania
    {"continent": "Oceania", "country": "Australia", "city": "Sydney", "region": "New South Wales", "lat": -33.8688, "lng": 151.2093},
    {"continent": "Oceania", "country": "Australia", "city": "Melbourne", "region": "Victoria", "lat": -37.8136, "lng": 144.9631},
    {"continent": "Oceania", "country": "Australia", "city": "Brisbane", "region": "Queensland", "lat": -27.4705, "lng": 153.0260},
    {"continent": "Oceania", "country": "Australia", "city": "Perth", "region": "Western Australia", "lat": -31.9505, "lng": 115.8605},
    {"continent": "Oceania", "country": "New Zealand", "city": "Auckland", "region": "Auckland", "lat": -36.8485, "lng": 174.7633},
    {"continent": "Oceania", "country": "New Zealand", "city": "Wellington", "region": "Wellington", "lat": -41.2865, "lng": 174.7762},
]

# Structured Continent -> Country -> Cities hierarchy covering all worldwide regions
CONTINENT_HIERARCHY: Dict[str, Dict[str, List[str]]] = {
    "Africa": {
        "Algeria": ["Algiers", "Oran", "Constantine"],
        "Angola": ["Luanda", "Huambo", "Lobito"],
        "Benin": ["Cotonou", "Porto-Novo"],
        "Botswana": ["Gaborone", "Francistown"],
        "Burkina Faso": ["Ouagadougou", "Bobo-Dioulasso"],
        "Burundi": ["Gitega", "Bujumbura"],
        "Cabo Verde": ["Praia", "Mindelo"],
        "Cameroon": ["Yaounde", "Douala", "Garoua"],
        "Central African Republic": ["Bangui", "Bimbo"],
        "Chad": ["N'Djamena", "Moundou"],
        "Comoros": ["Moroni", "Mutsamudu"],
        "Congo": ["Brazzaville", "Pointe-Noire"],
        "Democratic Republic of the Congo": ["Kinshasa", "Lubumbashi", "Goma"],
        "Cote d'Ivoire": ["Abidjan", "Yamoussoukro", "Bouake"],
        "Djibouti": ["Djibouti City", "Ali Sabieh"],
        "Egypt": ["Cairo", "Alexandria", "Giza"],
        "Equatorial Guinea": ["Malabo", "Bata"],
        "Eritrea": ["Asmara", "Keren"],
        "Eswatini": ["Mbabane", "Manzini"],
        "Ethiopia": ["Addis Ababa", "Dire Dawa"],
        "Gabon": ["Libreville", "Port-Gentil"],
        "Gambia": ["Banjul", "Serekunda"],
        "Ghana": ["Accra", "Kumasi", "Tamale"],
        "Guinea": ["Conakry", "Nzerekore"],
        "Guinea-Bissau": ["Bissau", "Bafata"],
        "Kenya": ["Nairobi", "Mombasa", "Kisumu"],
        "Lesotho": ["Maseru", "Teyateyaneng"],
        "Liberia": ["Monrovia", "Gbarnga"],
        "Libya": ["Tripoli", "Benghazi", "Misrata"],
        "Madagascar": ["Antananarivo", "Toamasina"],
        "Malawi": ["Lilongwe", "Blantyre"],
        "Mali": ["Bamako", "Sikasso"],
        "Mauritania": ["Nouakchott", "Nouadhibou"],
        "Mauritius": ["Port Louis", "Beau Bassin-Rose Hill"],
        "Morocco": ["Casablanca", "Rabat", "Marrakech", "Tangier"],
        "Mozambique": ["Maputo", "Beira", "Nampula"],
        "Namibia": ["Windhoek", "Walvis Bay", "Swakopmund"],
        "Niger": ["Niamey", "Zinder"],
        "Nigeria": ["Lagos", "Abuja", "Kano", "Ibadan"],
        "Rwanda": ["Kigali", "Butare"],
        "Sao Tome and Principe": ["Sao Tome"],
        "Senegal": ["Dakar", "Thies", "Saint-Louis"],
        "Seychelles": ["Victoria"],
        "Sierra Leone": ["Freetown", "Bo"],
        "Somalia": ["Mogadishu", "Hargeisa"],
        "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
        "South Sudan": ["Juba", "Malakal"],
        "Sudan": ["Khartoum", "Omdurman", "Port Sudan"],
        "Tanzania": ["Dar es Salaam", "Dodoma", "Mwanza"],
        "Togo": ["Lome", "Sokode"],
        "Tunisia": ["Tunis", "Sfax", "Sousse"],
        "Uganda": ["Kampala", "Entebbe"],
        "Zambia": ["Lusaka", "Ndola", "Kitwe"],
        "Zimbabwe": ["Harare", "Bulawayo"],
    },
    "Asia": {
        "Afghanistan": ["Kabul", "Herat", "Mazar-i-Sharif"],
        "Armenia": ["Yerevan", "Gyumri"],
        "Azerbaijan": ["Baku", "Ganja"],
        "Bahrain": ["Manama", "Riffa"],
        "Bangladesh": ["Dhaka", "Chittagong", "Sylhet"],
        "Bhutan": ["Thimphu", "Phuntsholing"],
        "Brunei": ["Bandar Seri Begawan"],
        "Cambodia": ["Phnom Penh", "Siem Reap"],
        "China": ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu"],
        "Cyprus": ["Nicosia", "Limassol"],
        "Georgia": ["Tbilisi", "Batumi"],
        "India": ["Mumbai", "Delhi", "Pune", "Bengaluru", "Hyderabad", "Chennai", "Kolkata"],
        "Indonesia": ["Jakarta", "Surabaya", "Bandung", "Medan"],
        "Iran": ["Tehran", "Isfahan", "Mashhad", "Shiraz"],
        "Iraq": ["Baghdad", "Basra", "Erbil"],
        "Israel": ["Jerusalem", "Tel Aviv", "Haifa"],
        "Japan": ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Fukuoka"],
        "Jordan": ["Amman", "Zarqa", "Irbid"],
        "Kazakhstan": ["Astana", "Almaty", "Shymkent"],
        "Kuwait": ["Kuwait City", "Al Ahmadi"],
        "Kyrgyzstan": ["Bishkek", "Osh"],
        "Laos": ["Vientiane", "Luang Prabang"],
        "Lebanon": ["Beirut", "Tripoli"],
        "Malaysia": ["Kuala Lumpur", "George Town", "Johor Bahru"],
        "Maldives": ["Male", "Addu City"],
        "Mongolia": ["Ulaanbaatar", "Erdenet"],
        "Myanmar": ["Yangon", "Mandalay", "Naypyidaw"],
        "Nepal": ["Kathmandu", "Pokhara", "Lalitpur"],
        "North Korea": ["Pyongyang", "Hamhung"],
        "Oman": ["Muscat", "Salalah"],
        "Pakistan": ["Karachi", "Lahore", "Islamabad", "Faisalabad"],
        "Palestine": ["East Jerusalem", "Ramallah", "Gaza"],
        "Philippines": ["Manila", "Quezon City", "Cebu City", "Davao City"],
        "Qatar": ["Doha", "Al Rayyan"],
        "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina"],
        "Singapore": ["Singapore"],
        "South Korea": ["Seoul", "Busan", "Incheon", "Daegu"],
        "Sri Lanka": ["Colombo", "Kandy", "Galle"],
        "Syria": ["Damascus", "Aleppo", "Homs"],
        "Tajikistan": ["Dushanbe", "Khujand"],
        "Thailand": ["Bangkok", "Chiang Mai", "Phuket"],
        "Timor-Leste": ["Dili", "Baucau"],
        "Turkey": ["Istanbul", "Ankara", "Izmir", "Antalya"],
        "Turkmenistan": ["Ashgabat", "Turkmenabat"],
        "UAE": ["Dubai", "Abu Dhabi", "Sharjah"],
        "Uzbekistan": ["Tashkent", "Samarkand", "Bukhara"],
        "Vietnam": ["Hanoi", "Ho Chi Minh City", "Da Nang"],
        "Yemen": ["Sanaa", "Aden", "Taiz"],
    },
    "Europe": {
        "Albania": ["Tirana", "Durres"],
        "Andorra": ["Andorra la Vella", "Escaldes-Engordany"],
        "Austria": ["Vienna", "Salzburg", "Graz", "Innsbruck"],
        "Belarus": ["Minsk", "Gomel"],
        "Belgium": ["Brussels", "Antwerp", "Ghent", "Bruges"],
        "Bosnia and Herzegovina": ["Sarajevo", "Banja Luka"],
        "Bulgaria": ["Sofia", "Plovdiv", "Varna"],
        "Croatia": ["Zagreb", "Split", "Rijeka", "Dubrovnik"],
        "Czechia": ["Prague", "Brno", "Ostrava"],
        "Denmark": ["Copenhagen", "Aarhus", "Odense"],
        "Estonia": ["Tallinn", "Tartu"],
        "Finland": ["Helsinki", "Espoo", "Tampere", "Oulu"],
        "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"],
        "Germany": ["Berlin", "Frankfurt", "Munich", "Hamburg", "Cologne"],
        "Greece": ["Athens", "Thessaloniki", "Patras", "Heraklion"],
        "Hungary": ["Budapest", "Debrecen", "Szeged"],
        "Iceland": ["Reykjavik", "Akureyri", "Keflavik"],
        "Ireland": ["Dublin", "Cork", "Galway", "Limerick"],
        "Italy": ["Rome", "Milan", "Naples", "Turin", "Florence"],
        "Latvia": ["Riga", "Daugavpils"],
        "Liechtenstein": ["Vaduz", "Schaan"],
        "Lithuania": ["Vilnius", "Kaunas", "Klaipeda"],
        "Luxembourg": ["Luxembourg City", "Esch-sur-Alzette"],
        "Malta": ["Valletta", "Birkirkara", "Sliema"],
        "Moldova": ["Chisinau", "Balti"],
        "Monaco": ["Monaco", "Monte Carlo"],
        "Montenegro": ["Podgorica", "Niksic"],
        "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
        "North Macedonia": ["Skopje", "Bitola"],
        "Norway": ["Oslo", "Bergen", "Trondheim", "Tromsø", "Stavanger"],
        "Poland": ["Warsaw", "Krakow", "Wroclaw", "Gdansk"],
        "Portugal": ["Lisbon", "Porto", "Braga", "Faro"],
        "Romania": ["Bucharest", "Cluj-Napoca", "Timisoara"],
        "Russia": ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg"],
        "San Marino": ["San Marino", "Serravalle"],
        "Serbia": ["Belgrade", "Novi Sad", "Nis"],
        "Slovakia": ["Bratislava", "Kosice"],
        "Slovenia": ["Ljubljana", "Maribor"],
        "Spain": ["Madrid", "Barcelona", "Valencia", "Seville", "Malaga"],
        "Sweden": ["Stockholm", "Gothenburg", "Malmo", "Uppsala"],
        "Switzerland": ["Zurich", "Geneva", "Basel", "Bern", "Lausanne"],
        "Ukraine": ["Kyiv", "Kharkiv", "Odesa", "Lviv", "Dnipro"],
        "England": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol", "Newcastle", "Sheffield"],
        "UK": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Edinburgh", "Glasgow"],
        "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Edinburgh", "Glasgow"],
        "Vatican City": ["Vatican City"],
    },
    "North America": {
        "Antigua and Barbuda": ["Saint John's"],
        "Bahamas": ["Nassau", "Freeport"],
        "Barbados": ["Bridgetown"],
        "Belize": ["Belmopan", "Belize City"],
        "Canada": ["Toronto", "Vancouver", "Montreal", "Ottawa", "Calgary"],
        "Costa Rica": ["San Jose", "Alajuela"],
        "Cuba": ["Havana", "Santiago de Cuba"],
        "Dominica": ["Roseau"],
        "Dominican Republic": ["Santo Domingo", "Santiago"],
        "El Salvador": ["San Salvador", "Santa Ana"],
        "Grenada": ["Saint George's"],
        "Guatemala": ["Guatemala City", "Antigua"],
        "Haiti": ["Port-au-Prince", "Cap-Haitien"],
        "Honduras": ["Tegucigalpa", "San Pedro Sula"],
        "Jamaica": ["Kingston", "Montego Bay"],
        "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Cancun"],
        "Nicaragua": ["Managua", "Leon"],
        "Panama": ["Panama City", "Colon"],
        "Saint Kitts and Nevis": ["Basseterre"],
        "Saint Lucia": ["Castries"],
        "Saint Vincent and the Grenadines": ["Kingstown"],
        "Trinidad and Tobago": ["Port of Spain", "San Fernando"],
        "USA": ["New York", "Los Angeles", "Chicago", "San Francisco", "Seattle", "Dallas", "Atlanta"],
    },
    "South America": {
        "Argentina": ["Buenos Aires", "Cordoba", "Rosario", "Mendoza"],
        "Bolivia": ["La Paz", "Sucre", "Santa Cruz de la Sierra"],
        "Brazil": ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza"],
        "Chile": ["Santiago", "Valparaiso", "Concepcion"],
        "Colombia": ["Bogota", "Medellin", "Cali", "Barranquilla"],
        "Ecuador": ["Quito", "Guayaquil", "Cuenca"],
        "Guyana": ["Georgetown", "Linden"],
        "Paraguay": ["Asuncion", "Ciudad del Este"],
        "Peru": ["Lima", "Arequipa", "Cusco", "Trujillo"],
        "Suriname": ["Paramaribo", "Lelydorp"],
        "Uruguay": ["Montevideo", "Salto"],
        "Venezuela": ["Caracas", "Maracaibo", "Valencia"],
    },
    "Oceania": {
        "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"],
        "Fiji": ["Suva", "Nadi"],
        "Kiribati": ["South Tarawa", "Betio"],
        "Marshall Islands": ["Majuro", "Ebeye"],
        "Micronesia": ["Palikir", "Weno"],
        "Nauru": ["Yaren"],
        "New Zealand": ["Auckland", "Wellington", "Christchurch", "Hamilton"],
        "Palau": ["Ngerulmud", "Koror"],
        "Papua New Guinea": ["Port Moresby", "Lae"],
        "Samoa": ["Apia"],
        "Solomon Islands": ["Honiara"],
        "Tonga": ["Nuku'alofa"],
        "Tuvalu": ["Funafuti"],
        "Vanuatu": ["Port Vila", "Luganville"],
    },
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth in km."""
    rad_lat1 = math.radians(lat1)
    rad_lat2 = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2.0) ** 2
        + math.cos(rad_lat1) * math.cos(rad_lat2) * math.sin(delta_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return 6371.0 * c


def infer_continent_from_bounds(lat: float, lon: float) -> str:
    """Fallback continent classifier using geographic coordinate bounding boxes."""
    if -56.0 <= lat <= 14.0 and -85.0 <= lon <= -30.0:
        return "South America"
    if 5.0 <= lat <= 85.0 and -170.0 <= lon <= -50.0:
        return "North America"
    if 35.0 <= lat <= 72.0 and -25.0 <= lon <= 45.0:
        return "Europe"
    if -36.0 <= lat <= 38.0 and -20.0 <= lon <= 55.0:
        return "Africa"
    if -50.0 <= lat <= -10.0 and 110.0 <= lon <= 180.0:
        return "Oceania"
    if -12.0 <= lat <= 80.0 and 25.0 <= lon <= 180.0:
        return "Asia"
    return "Europe" if lat >= 35.0 else "Asia"


# Pre-computed canonical country -> continent mapping to enforce strict geographic exclusivity
CANONICAL_COUNTRY_TO_CONTINENT: Dict[str, str] = {}
for _cont, _countries in CONTINENT_HIERARCHY.items():
    for _k in _countries.keys():
        CANONICAL_COUNTRY_TO_CONTINENT[_k.lower()] = _cont

# Explicit aliases and canonical overrides
CANONICAL_COUNTRY_TO_CONTINENT.update({
    "india": "Asia",
    "bharat": "Asia",
    "china": "Asia",
    "japan": "Asia",
    "nippon": "Asia",
    "south korea": "Asia",
    "korea": "Asia",
    "singapore": "Asia",
    "thailand": "Asia",
    "indonesia": "Asia",
    "malaysia": "Asia",
    "philippines": "Asia",
    "vietnam": "Asia",
    "turkey": "Asia",
    "türkiye": "Asia",
    "uae": "Asia",
    "united arab emirates": "Asia",
    "saudi arabia": "Asia",
    "qatar": "Asia",
    "england": "Europe",
    "uk": "Europe",
    "united kingdom": "Europe",
    "great britain": "Europe",
    "france": "Europe",
    "germany": "Europe",
    "deutschland": "Europe",
    "italy": "Europe",
    "italia": "Europe",
    "spain": "Europe",
    "españa": "Europe",
    "netherlands": "Europe",
    "nederland": "Europe",
    "norway": "Europe",
    "norge": "Europe",
    "sweden": "Europe",
    "sverige": "Europe",
    "finland": "Europe",
    "suomi": "Europe",
    "denmark": "Europe",
    "danmark": "Europe",
    "iceland": "Europe",
    "island": "Europe",
    "ísland": "Europe",
    "ireland": "Europe",
    "éire": "Europe",
    "portugal": "Europe",
    "greece": "Europe",
    "ellada": "Europe",
    "austria": "Europe",
    "österreich": "Europe",
    "belgium": "Europe",
    "switzerland": "Europe",
    "schweiz": "Europe",
    "poland": "Europe",
    "polska": "Europe",
    "russia": "Europe",
    "usa": "North America",
    "united states": "North America",
    "united states of america": "North America",
    "us": "North America",
    "canada": "North America",
    "mexico": "North America",
    "méxico": "North America",
    "brazil": "South America",
    "brasil": "South America",
    "argentina": "South America",
    "colombia": "South America",
    "chile": "South America",
    "peru": "South America",
    "perú": "South America",
    "australia": "Oceania",
    "new zealand": "Oceania",
    "aotearoa": "Oceania",
    "egypt": "Africa",
    "south africa": "Africa",
    "nigeria": "Africa",
    "kenya": "Africa",
    "morocco": "Africa",
    "ghana": "Africa",
    "namibia": "Africa",
})


def infer_continent_from_country(country_name: Optional[str]) -> Optional[str]:
    """Reliably map country name to its unique canonical continent worldwide."""
    if not country_name:
        return None
    c_clean = country_name.strip()
    c_lower = c_clean.lower()

    # 1. Direct canonical dictionary match (exact, O(1), no ambiguity)
    if c_lower in CANONICAL_COUNTRY_TO_CONTINENT:
        return CANONICAL_COUNTRY_TO_CONTINENT[c_lower]

    # 2. Check normalized name alias
    normalized = COUNTRY_NORMALIZATION.get(c_lower, c_clean)
    norm_lower = normalized.lower()
    if norm_lower in CANONICAL_COUNTRY_TO_CONTINENT:
        return CANONICAL_COUNTRY_TO_CONTINENT[norm_lower]

    # 3. Check exact match in CONTINENT_HIERARCHY
    for cont, countries in CONTINENT_HIERARCHY.items():
        for k in countries.keys():
            if norm_lower == k.lower() or c_lower == k.lower():
                return cont

    # 4. Fallback keyword heuristics for common region names
    if any(k in norm_lower for k in ["africa", "namibia", "sahara"]):
        return "Africa"
    if any(k in norm_lower for k in ["asia", "emirates", "arabia"]):
        return "Asia"
    if any(k in norm_lower for k in ["europe"]):
        return "Europe"
    if any(k in norm_lower for k in ["america", "caribbean"]):
        return "North America"
    if any(k in norm_lower for k in ["oceania", "pacific"]):
        return "Oceania"

    return None


def get_dynamic_location_hierarchy(db: Any) -> Dict[str, Any]:
    """Build dynamic hierarchy and distinct lists of continents, countries, and cities directly from DB and global coverage.
    
    Guarantees strict geographic exclusivity:
    - Every country belongs ONLY to its own canonical continent.
    - Database row continent values can NEVER override canonical geography (e.g. India can never appear under Europe).
    - If Continent = Europe is queried, only European countries are returned.
    - If Country = England is queried, only England cities are returned.
    """
    import copy
    from sqlalchemy import select
    from backend.app.models import Asset

    # Start with global baseline hierarchy
    hierarchy: Dict[str, Dict[str, List[str]]] = copy.deepcopy(CONTINENT_HIERARCHY)

    # Query distinct location combinations from database
    stmt = (
        select(Asset.continent, Asset.country, Asset.city)
        .distinct()
        .where(Asset.country.is_not(None), Asset.country != "", Asset.country != "None")
    )
    db_records = db.execute(stmt).all()

    for cont_val, country_val, city_val in db_records:
        if not country_val or country_val.strip() in ("", "None", "Unknown"):
            continue
        country = country_val.strip()

        # CANONICAL CONTINENT ALWAYS PREVAILS OVER DATABASE ROW DATA
        canonical_cont = infer_continent_from_country(country)
        if canonical_cont:
            continent = canonical_cont
        elif cont_val and cont_val.strip() not in ("", "None", "Unknown") and cont_val.strip() in hierarchy:
            continent = cont_val.strip()
        else:
            continent = "Other"

        # STRICT DEDUPLICATION: Purge country from any other continent in hierarchy
        for other_cont in list(hierarchy.keys()):
            if other_cont != continent:
                for existing_k in list(hierarchy[other_cont].keys()):
                    if existing_k.lower() == country.lower():
                        del hierarchy[other_cont][existing_k]

        if continent not in hierarchy:
            hierarchy[continent] = {}

        # Find matching country key case-insensitively or create new
        matched_country_key = country
        for k in hierarchy[continent].keys():
            if k.lower() == country.lower():
                matched_country_key = k
                break

        if matched_country_key not in hierarchy[continent]:
            hierarchy[continent][matched_country_key] = []

        if city_val and city_val.strip() and city_val.strip() not in ("", "None", "Unknown"):
            city = city_val.strip()
            if city not in hierarchy[continent][matched_country_key]:
                hierarchy[continent][matched_country_key].append(city)

    # Final verification pass: Ensure no country is listed in more than one continent
    seen_countries: Dict[str, str] = {}
    for cont in list(hierarchy.keys()):
        for country_key in list(hierarchy[cont].keys()):
            ck_lower = country_key.lower()
            if ck_lower in seen_countries:
                canonical = infer_continent_from_country(country_key)
                if canonical and canonical != cont:
                    del hierarchy[cont][country_key]
                elif canonical and canonical != seen_countries[ck_lower]:
                    prev_cont = seen_countries[ck_lower]
                    if country_key in hierarchy.get(prev_cont, {}):
                        del hierarchy[prev_cont][country_key]
                    seen_countries[ck_lower] = cont
            else:
                seen_countries[ck_lower] = cont

    # Sort cities in every country and construct flattened sets & reverse map
    all_continents = sorted(list(hierarchy.keys()))
    all_countries_set = set()
    all_cities_set = set()
    country_to_continent: Dict[str, str] = {}

    for cont, countries_map in hierarchy.items():
        for country, cities_list in list(countries_map.items()):
            countries_map[country] = sorted(list(set(cities_list)))
            all_countries_set.add(country)
            country_to_continent[country] = cont
            for c in cities_list:
                all_cities_set.add(c)

    return {
        "continents": all_continents,
        "countries": sorted(list(all_countries_set)),
        "cities": sorted(list(all_cities_set)),
        "hierarchy": hierarchy,
        "country_to_continent": country_to_continent,
    }


def reverse_geocode_nominatim(lat: float, lon: float) -> Optional[Dict[str, str]]:
    """Attempt fast online reverse geocoding via OpenStreetMap Nominatim API."""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat:.5f}&lon={lon:.5f}&format=json&zoom=10&addressdetails=1"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "NexusNet-Telecom-System/1.0",
                "Accept-Language": "en",
            },
        )
        with urllib.request.urlopen(req, timeout=1.8) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                address = data.get("address", {})
                raw_country = address.get("country", "")
                norm_country = COUNTRY_NORMALIZATION.get(raw_country.strip().lower(), raw_country)

                city = (
                    address.get("city")
                    or address.get("town")
                    or address.get("municipality")
                    or address.get("village")
                    or address.get("county")
                    or "Unknown City"
                )
                region = address.get("state") or address.get("county") or norm_country
                continent = infer_continent_from_bounds(lat, lon)

                # Check continent from country
                for c_name, c_countries in CONTINENT_HIERARCHY.items():
                    if any(k.lower() == norm_country.lower() for k in c_countries.keys()):
                        continent = c_name
                        break

                return {
                    "city": str(city).strip(),
                    "region": str(region).strip(),
                    "country": str(norm_country).strip(),
                    "continent": continent,
                }
    except Exception:
        pass
    return None


def resolve_location_from_coords(
    lat: Optional[float], lon: Optional[float]
) -> Dict[str, Any]:
    """Resolve latitude and longitude coordinates into continent, country, city, and region.

    Uses real-world online reverse geocoding first, followed by nearest telecom hub centroid.
    """
    if lat is None or lon is None:
        return {
            "continent": None,
            "country": None,
            "city": None,
            "region": None,
            "distance_km": None,
        }

    cache_key = f"{round(lat, 4)}:{round(lon, 4)}"
    if cache_key in _GEO_CACHE:
        return _GEO_CACHE[cache_key]

    # 1. Fast path: If within 25 km of a known reference telecom hub, resolve instantly
    closest_loc = None
    min_dist = float("inf")

    for loc in REFERENCE_LOCATIONS:
        dist = haversine_distance_km(lat, lon, loc["lat"], loc["lng"])
        if dist < min_dist:
            min_dist = dist
            closest_loc = loc

    if closest_loc and min_dist <= 25.0:
        res = {
            "continent": closest_loc["continent"],
            "country": closest_loc["country"],
            "city": closest_loc["city"],
            "region": closest_loc["region"],
            "distance_km": round(min_dist, 1),
        }
        _GEO_CACHE[cache_key] = res
        return res

    # 2. Try Nominatim reverse geocode for exact town/city/country anywhere on Earth
    online_res = reverse_geocode_nominatim(lat, lon)
    if online_res and online_res.get("city") and online_res.get("country"):
        res = {
            "continent": online_res["continent"],
            "country": online_res["country"],
            "city": online_res["city"],
            "region": online_res["region"],
            "distance_km": 0.0,
        }
        _GEO_CACHE[cache_key] = res
        return res

    # 3. Fallback to closest reference hub
    if closest_loc:
        res = {
            "continent": closest_loc["continent"],
            "country": closest_loc["country"],
            "city": closest_loc["city"],
            "region": closest_loc["region"],
            "distance_km": round(min_dist, 1),
        }
        _GEO_CACHE[cache_key] = res
        return res

    inferred_continent = infer_continent_from_bounds(lat, lon)
    res = {
        "continent": inferred_continent,
        "country": "Unknown",
        "city": "Unknown",
        "region": "Unknown",
        "distance_km": None,
    }
    _GEO_CACHE[cache_key] = res
    return res


def search_global_location(query: str) -> List[Dict[str, Any]]:
    """Search for ANY city or country on Earth to identify coordinates for map fly-to."""
    q_clean = query.strip().lower()
    if not q_clean:
        return []

    results: List[Dict[str, Any]] = []

    # 1. Match local reference hubs
    for loc in REFERENCE_LOCATIONS:
        if (
            q_clean in loc["city"].lower()
            or q_clean in loc["country"].lower()
            or q_clean in loc["region"].lower()
        ):
            results.append(
                {
                    "city": loc["city"],
                    "country": loc["country"],
                    "region": loc["region"],
                    "continent": loc["continent"],
                    "latitude": loc["lat"],
                    "longitude": loc["lng"],
                    "label": f"{loc['city']}, {loc['country']} ({loc['continent']})",
                }
            )

    # 2. If limited results, search Nominatim forward geocode
    if len(results) < 5:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=5&addressdetails=1"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "NexusNet-Telecom-System/1.0", "Accept-Language": "en"},
            )
            with urllib.request.urlopen(req, timeout=1.8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    for item in data:
                        addr = item.get("address", {})
                        lat_val = float(item["lat"])
                        lon_val = float(item["lon"])
                        raw_c = addr.get("country", "")
                        norm_c = COUNTRY_NORMALIZATION.get(raw_c.strip().lower(), raw_c)
                        city_name = (
                            addr.get("city")
                            or addr.get("town")
                            or addr.get("municipality")
                            or addr.get("state")
                            or item.get("display_name", "").split(",")[0]
                        )
                        continent = infer_continent_from_bounds(lat_val, lon_val)

                        results.append(
                            {
                                "city": city_name,
                                "country": norm_c,
                                "region": addr.get("state") or norm_c,
                                "continent": continent,
                                "latitude": lat_val,
                                "longitude": lon_val,
                                "label": f"{city_name}, {norm_c} ({continent})",
                            }
                        )
        except Exception:
            pass

    # Deduplicate results by rounded coordinates
    unique: List[Dict[str, Any]] = []
    seen = set()
    for r in results:
        key = (round(r["latitude"], 2), round(r["longitude"], 2))
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique[:8]
