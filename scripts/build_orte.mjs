import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CITIES_FILE = join(ROOT, "data", "staedte.json");
const PLACES_FILE = join(ROOT, "data", "orte.json");

export const TARGET_PLACE_COUNT = 2000;
const GRID_SIZE_DEGREES = 5;

function coordinateKey(place) {
  return `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
}

function gridKey(place) {
  const latitudeCell = Math.floor((place.latitude + 90) / GRID_SIZE_DEGREES);
  const longitudeCell = Math.floor((place.longitude + 180) / GRID_SIZE_DEGREES);
  return `${latitudeCell},${longitudeCell}`;
}

function isCapital(city) {
  return ["capital", "is_capital", "capital_status"].some((key) => {
    const value = city[key];
    return value === true || value === 1 ||
      (typeof value === "string" && /^(primary|yes|true|capital)$/i.test(value));
  });
}

function compareCities(left, right) {
  return (Number(right.population) || 0) - (Number(left.population) || 0) ||
    left.name.localeCompare(right.name);
}

export function selectClimatePlaces(existingPlaces, cities, target = TARGET_PLACE_COUNT) {
  if (!Array.isArray(existingPlaces) || !Array.isArray(cities)) {
    throw new Error("Orts- und Städtedaten müssen Listen sein.");
  }

  const places = [...existingPlaces];
  const knownCoordinates = new Set(places.map(coordinateKey));
  const availableCities = cities
    .filter((city) => city.name && Number.isFinite(city.latitude) &&
      Number.isFinite(city.longitude) && city.latitude >= -90 && city.latitude <= 90 &&
      city.longitude >= -180 && city.longitude <= 180)
    .sort(compareCities);

  function addCity(city) {
    const key = coordinateKey(city);
    if (places.length >= target || knownCoordinates.has(key)) return;
    places.push({
      name: city.name,
      land: city.country || city.land || "Land unbekannt",
      latitude: city.latitude,
      longitude: city.longitude
    });
    knownCoordinates.add(key);
  }

  const largestByGridCell = new Map();
  for (const city of availableCities) {
    const key = gridKey(city);
    if (!largestByGridCell.has(key)) largestByGridCell.set(key, city);
  }
  for (const city of largestByGridCell.values()) addCity(city);

  for (const city of availableCities) {
    if (isCapital(city)) addCity(city);
  }
  for (const city of availableCities) addCity(city);

  return places;
}

async function build() {
  const [existingPlaces, cities] = await Promise.all([
    readFile(PLACES_FILE, "utf8").then(JSON.parse),
    readFile(CITIES_FILE, "utf8").then(JSON.parse)
  ]);
  const places = selectClimatePlaces(existingPlaces, cities);
  await writeFile(PLACES_FILE, `${JSON.stringify(places, null, 2)}\n`);
  console.log(`${places.length} von ${TARGET_PLACE_COUNT} Klima-Orten ausgewählt.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  build().catch((error) => {
    console.error(`Die Ortsliste wurde nicht aktualisiert: ${error.message}`);
    process.exitCode = 1;
  });
}
