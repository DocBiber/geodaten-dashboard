import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PLACES_FILE = join(ROOT, "data", "orte.json");
const OUTPUT_FILE = join(ROOT, "data", "klimadaten.json");
const FIRST_YEAR = 2015;
const LAST_YEAR = 2024;
const API_URL = "https://archive-api.open-meteo.com/v1/archive";
const PAUSE_MS = 1100;
const MAX_ATTEMPTS = 3;
export const MAX_PLACES_PER_RUN = 90;

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function summarizeDailyData(place, response) {
  const dates = response.daily?.time;
  const temperatures = response.daily?.temperature_2m_mean;
  const precipitation = response.daily?.precipitation_sum;
  if (!Array.isArray(dates) || !Array.isArray(temperatures) || !Array.isArray(precipitation) ||
      dates.length !== temperatures.length || dates.length !== precipitation.length || !dates.length) {
    throw new Error(`Ungültige Tagesdaten für ${place.name}.`);
  }

  const monthlyTemperatures = Array.from({ length: 12 }, () => []);
  const monthlyPrecipitation = Array.from({ length: 12 }, () => new Map());
  const annualTemperatures = [];
  const annualPrecipitation = new Map();

  for (let index = 0; index < dates.length; index += 1) {
    const year = Number(dates[index].slice(0, 4));
    const month = Number(dates[index].slice(5, 7)) - 1;
    if (year < FIRST_YEAR || year > LAST_YEAR || month < 0 || month > 11) continue;

    const temperature = temperatures[index];
    const rainfall = precipitation[index];
    if (Number.isFinite(temperature)) {
      monthlyTemperatures[month].push(temperature);
      annualTemperatures.push(temperature);
    }
    if (Number.isFinite(rainfall)) {
      annualPrecipitation.set(year, (annualPrecipitation.get(year) || 0) + rainfall);
      const monthTotals = monthlyPrecipitation[month];
      monthTotals.set(year, (monthTotals.get(year) || 0) + rainfall);
    }
  }

  const temperaturesByMonth = monthlyTemperatures.map(average);
  const precipitationByMonth = monthlyPrecipitation.map((yearTotals) => average([...yearTotals.values()]));
  if (temperaturesByMonth.some((value) => value === null) ||
      precipitationByMonth.some((value) => value === null) || !annualTemperatures.length) {
    throw new Error(`Unvollständige Tagesdaten für ${place.name}.`);
  }

  const annualMeanTemperature = average(annualTemperatures);
  const annualMeanPrecipitation = average([...annualPrecipitation.values()]);
  return {
    ...place,
    elevation_m: Number.isFinite(response.elevation) ? response.elevation : null,
    monthlyMeanTemperature_C: temperaturesByMonth.map(roundToOneDecimal),
    meanMonthlyPrecipitation_mm: precipitationByMonth.map(roundToOneDecimal),
    annualMeanTemperature_C: annualMeanTemperature,
    annualPrecipitation_mm: annualMeanPrecipitation,
    temperatureAmplitude_C: Math.max(...temperaturesByMonth) - Math.min(...temperaturesByMonth)
  };
}

export async function fetchPlace(place) {
  const parameters = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    start_date: `${FIRST_YEAR}-01-01`,
    end_date: `${LAST_YEAR}-12-31`,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: "UTC"
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}?${parameters}`);
      if (response.status === 429) {
        const error = new Error("Open-Meteo hat HTTP 429 gemeldet.");
        error.status = 429;
        throw error;
      }
      if (!response.ok) throw new Error(`Open-Meteo antwortete mit HTTP ${response.status}.`);
      return summarizeDailyData(place, await response.json());
    } catch (error) {
      if (attempt === MAX_ATTEMPTS || error.status === 429) throw error;
      console.warn(`${place.name}: Versuch ${attempt} fehlgeschlagen: ${error.message}`);
      await pause(PAUSE_MS * attempt);
    }
  }
}

function placeKey(place) {
  return `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
}

async function saveClimateData(file, data) {
  const temporaryFile = `${file}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporaryFile, file);
}

export async function buildClimateData({
  placesFile = PLACES_FILE,
  outputFile = OUTPUT_FILE,
  fetchClimatePlace = fetchPlace,
  wait = pause,
  log = console.log,
  errorLog = console.error,
  maxPlaces = MAX_PLACES_PER_RUN
} = {}) {
  const places = JSON.parse(await readFile(placesFile, "utf8"));
  if (!Array.isArray(places) || !places.length) {
    throw new Error("Die Ortsliste enthält keine Klima-Orte.");
  }
  const climateData = JSON.parse(await readFile(outputFile, "utf8"));
  if (!Array.isArray(climateData.places)) {
    throw new Error("Die Klimadatei enthält keine gültige Ortsliste.");
  }
  const climatePlaces = climateData.places;
  let hasRoundedMonthlyValues = false;
  for (const climatePlace of climatePlaces) {
    for (const key of ["monthlyMeanTemperature_C", "meanMonthlyPrecipitation_mm"]) {
      if (!Array.isArray(climatePlace[key])) continue;
      climatePlace[key] = climatePlace[key].map((value) => {
        if (!Number.isFinite(value)) return value;
        const rounded = roundToOneDecimal(value);
        if (rounded !== value) hasRoundedMonthlyValues = true;
        return rounded;
      });
    }
  }
  if (hasRoundedMonthlyValues) await saveClimateData(outputFile, climateData);
  const cachedCoordinates = new Set(climatePlaces.map(placeKey));
  const missingPlaces = places.filter((place) => !cachedCoordinates.has(placeKey(place)));
  const batchSize = Math.min(MAX_PLACES_PER_RUN, Math.max(0, maxPlaces));
  const placesToFetch = missingPlaces.slice(0, batchSize);
  const completedCount = () => places.filter((place) => cachedCoordinates.has(placeKey(place))).length;

  log(`${completedCount()} von ${places.length} Orten fertig.`);
  for (let index = 0; index < placesToFetch.length; index += 1) {
    const place = placesToFetch[index];
    if (index) await wait(PAUSE_MS);
    log(`[${index + 1}/${placesToFetch.length}] ${place.name}`);
    try {
      climatePlaces.push(await fetchClimatePlace(place));
      cachedCoordinates.add(placeKey(place));
      await saveClimateData(outputFile, climateData);
      log(`${completedCount()} von ${places.length} Orten fertig.`);
    } catch (error) {
      errorLog(`Abruf für ${place.name} abgebrochen: ${error.message}`);
      return { completed: completedCount(), total: places.length, failed: true };
    }
  }
  return { completed: completedCount(), total: places.length, failed: false };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  buildClimateData()
    .then(({ failed }) => {
      if (failed) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`Klimadaten wurden nicht aktualisiert: ${error.message}`);
      process.exitCode = 1;
    });
}
