/**
 * "Around you in English" (user request: use the location for immersive
 * experiences, as if living abroad). With the location the student allows on
 * tap, the browser asks OpenStreetMap (Overpass, free, CORS) for places
 * nearby; each kind of place becomes a real situation to act out with EVO in
 * AI Speaking (?place=<kind>). The position goes from the phone straight to
 * OpenStreetMap: it never reaches our servers and is never stored. Without a
 * location, the same situations are offered as a list. Traffic data was left
 * out (paid APIs, little learning value).
 */

export const PLACE_KINDS = [
  "cafe",
  "restaurant",
  "pharmacy",
  "supermarket",
  "bank",
  "hotel",
  "transport",
  "clinic",
  "park",
  "museum",
  "gym",
  "clothes",
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

type PlaceTalk = {
  /** English label of the place (translated on screen through uiPt). */
  label: string;
  /** What the student practises there (translated on screen). */
  practice: string;
  role: string;
  opener: string;
};

export const PLACE_TALK: Record<PlaceKind, PlaceTalk> = {
  cafe: {
    label: "Café",
    practice: "Order a drink and a snack",
    role: "You are a friendly barista in a busy café in an English-speaking city. Take the student's order, ask about size, milk and whether it is to stay or to go, suggest a snack and tell them the price.",
    opener: "Hi there! What can I get for you today?",
  },
  restaurant: {
    label: "Restaurant",
    practice: "Book a table and order a meal",
    role: "You are a waiter in a restaurant in an English-speaking city. Welcome the student, ask how many people, take their order, answer questions about the menu and bring the bill at the end.",
    opener: "Good evening, welcome! Do you have a reservation?",
  },
  pharmacy: {
    label: "Pharmacy",
    practice: "Ask for something for a cold or a headache",
    role: "You are a pharmacist in an English-speaking country. Ask the student about their symptoms, suggest an over-the-counter product and explain how to take it. Never give real medical advice beyond common over-the-counter use; suggest a doctor for anything serious.",
    opener: "Hello, how can I help you today?",
  },
  supermarket: {
    label: "Supermarket",
    practice: "Find products and pay at the checkout",
    role: "You are a supermarket employee and then the cashier in an English-speaking city. Help the student find products, then at the checkout ask about a bag, a loyalty card and how they want to pay.",
    opener: "Hi! Are you looking for something in particular?",
  },
  bank: {
    label: "Bank",
    practice: "Open an account or exchange money",
    role: "You are a bank clerk in an English-speaking country. Help the student open an account or exchange money: ask for documents, explain the fees simply and confirm the details.",
    opener: "Good morning! How can I help you today?",
  },
  hotel: {
    label: "Hotel",
    practice: "Check in and ask about the hotel",
    role: "You are a hotel receptionist in an English-speaking city. Check the student in: ask for the reservation name and passport, explain breakfast time, Wi-Fi and checkout, and answer their questions.",
    opener: "Welcome to the hotel! Are you checking in?",
  },
  transport: {
    label: "Station",
    practice: "Buy a ticket and ask for directions",
    role: "You are a ticket office clerk at a bus and train station in an English-speaking city. Help the student buy a ticket, explain platforms, times and changes, and give simple directions.",
    opener: "Hi, where would you like to go today?",
  },
  clinic: {
    label: "Clinic",
    practice: "Make an appointment and describe how you feel",
    role: "You are the receptionist at a medical clinic in an English-speaking country. Help the student make an appointment: ask for their name, date of birth, what the problem is in simple terms and the best time. Do not give medical advice.",
    opener: "Good morning, clinic reception. How can I help?",
  },
  park: {
    label: "Park",
    practice: "Small talk with someone in the park",
    role: "You are a friendly local walking a dog in a park in an English-speaking city. Make small talk with the student: the weather, the park, weekend plans and where they are from.",
    opener: "Lovely day for a walk, isn't it? Do you come here often?",
  },
  museum: {
    label: "Museum",
    practice: "Buy tickets and ask about the exhibitions",
    role: "You work at the information desk of a museum in an English-speaking city. Sell the student a ticket, explain the current exhibitions, opening hours, the café and the gift shop.",
    opener: "Hello! Would you like tickets for today?",
  },
  gym: {
    label: "Gym",
    practice: "Sign up and talk about your training",
    role: "You are a receptionist and personal trainer at a gym in an English-speaking city. Help the student sign up: explain the plans and timetable, ask about their training goals and suggest a class.",
    opener: "Hi! Are you interested in joining the gym?",
  },
  clothes: {
    label: "Clothes shop",
    practice: "Try clothes on and ask for another size",
    role: "You are a shop assistant in a clothes shop in an English-speaking city. Help the student find clothes, sizes and colours, show the fitting rooms, and explain returns and payment.",
    opener: "Hi! Can I help you find anything today?",
  },
};

export function isPlaceKind(value: unknown): value is PlaceKind {
  return typeof value === "string" && (PLACE_KINDS as readonly string[]).includes(value);
}

/** AI Speaking role for acting out a situation at a kind of place. */
export function placeRolePlay(kind: PlaceKind) {
  const talk = PLACE_TALK[kind];
  return {
    id: `place-${kind}`,
    label: talk.label,
    scenario: "everyday" as const,
    goals: [],
    role: `${talk.role} The student is practising English as if living abroad: keep the situation realistic, at their level, one short turn at a time.`,
    opener: talk.opener,
  };
}

/** The OpenStreetMap kinds that map to each place. */
export function placeKindOf(tags: Record<string, string | undefined>): PlaceKind | null {
  const amenity = tags["amenity"];
  const shop = tags["shop"];
  if (amenity === "cafe") return "cafe";
  if (amenity === "restaurant" || amenity === "fast_food") return "restaurant";
  if (amenity === "pharmacy" || shop === "chemist") return "pharmacy";
  if (shop === "supermarket" || shop === "convenience") return "supermarket";
  if (amenity === "bank" || amenity === "bureau_de_change") return "bank";
  if (tags["tourism"] === "hotel" || tags["tourism"] === "hostel") return "hotel";
  if (
    amenity === "bus_station" ||
    tags["railway"] === "station" ||
    tags["public_transport"] === "station"
  )
    return "transport";
  if (amenity === "clinic" || amenity === "hospital" || amenity === "doctors") return "clinic";
  if (tags["leisure"] === "park") return "park";
  if (tags["tourism"] === "museum") return "museum";
  if (tags["leisure"] === "fitness_centre" || tags["leisure"] === "sports_centre") return "gym";
  if (shop === "clothes" || shop === "shoes") return "clothes";
  return null;
}

/** Overpass query for the places above within `radius` metres. */
export function overpassQuery(lat: number, lon: number, radius = 800) {
  const around = `(around:${radius},${lat.toFixed(4)},${lon.toFixed(4)})`;
  const parts = [
    `nwr["amenity"~"^(cafe|restaurant|fast_food|pharmacy|bank|bureau_de_change|bus_station|clinic|hospital|doctors)$"]${around};`,
    `nwr["shop"~"^(supermarket|convenience|chemist|clothes|shoes)$"]${around};`,
    `nwr["tourism"~"^(hotel|hostel|museum)$"]${around};`,
    `nwr["leisure"~"^(park|fitness_centre|sports_centre)$"]${around};`,
    `nwr["railway"="station"]${around};`,
  ];
  return `[out:json][timeout:15];(${parts.join("")});out center 80;`;
}

export type NearbyPlace = { kind: PlaceKind; name: string | null; metres: number };

function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** The nearest place of each kind, closest first (at most `limit`). */
export function nearbyPlaces(
  response: { elements?: OverpassElement[] } | null | undefined,
  lat: number,
  lon: number,
  limit = 6,
): NearbyPlace[] {
  const best = new Map<PlaceKind, NearbyPlace>();
  for (const element of response?.elements ?? []) {
    const point = element.center ?? (element.lat !== undefined ? element : null);
    if (!point || point.lat === undefined || point.lon === undefined || !element.tags) continue;
    const kind = placeKindOf(element.tags);
    if (!kind) continue;
    const metres = distanceMetres(lat, lon, point.lat, point.lon);
    const current = best.get(kind);
    if (!current || metres < current.metres) {
      best.set(kind, { kind, name: element.tags["name"]?.slice(0, 60) ?? null, metres });
    }
  }
  return [...best.values()].sort((a, b) => a.metres - b.metres).slice(0, limit);
}

/** Every English label of the places, for the translation check. */
export const AROUND_YOU_LABELS = PLACE_KINDS.flatMap((kind) => [
  PLACE_TALK[kind].label,
  PLACE_TALK[kind].practice,
]);
