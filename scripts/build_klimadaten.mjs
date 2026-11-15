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

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
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
    monthlyMeanTemperature_C: temperaturesByMonth,
    meanMonthlyPrecipitation_mm: precipitationByMonth,
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
        if (attempt === MAX_ATTEMPTS) {
          throw new Error("Open-Meteo hat nach mehreren Versuchen weiterhin HTTP 429 gemeldet.");
        }
        const retryAfter = response.headers.get("retry-after");
        const retrySeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
        const retryDate = retryAfter === null ? Number.NaN : Date.parse(retryAfter);
        const delay = Number.isFinite(retrySeconds)
          ? Math.max(0, retrySeconds * 1000)
          : Number.isFinite(retryDate)
            ? Math.max(0, retryDate - Date.now())
            : PAUSE_MS * attempt;
        console.warn(`${place.name}: Rate-Limit (HTTP 429), neuer Versuch in ${delay} ms.`);
        await pause(delay);
        continue;
      }
      if (!response.ok) throw new Error(`Open-Meteo antwortete mit HTTP ${response.status}.`);
      return summarizeDailyData(place, await response.json());
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      console.warn(`${place.name}: Versuch ${attempt} fehlgeschlagen: ${error.message}`);
      await pause(PAUSE_MS * attempt);
    }
  }
}

async function build() {
  const places = JSON.parse(await readFile(PLACES_FILE, "utf8"));
  if (!Array.isArray(places) || !places.length) {
    throw new Error("Die Ortsliste enthält keine Klima-Orte.");
  }
  const climatePlaces = [];
  for (let index = 0; index < places.length; index += 1) {
    if (index) await pause(PAUSE_MS);
    console.log(`[${index + 1}/${places.length}] ${places[index].name}`);
    climatePlaces.push(await fetchPlace(places[index]));
  }

  const output = {
    source: "Open-Meteo Archive API",
    license: "CC BY 4.0",
    period: { startYear: FIRST_YEAR, endYear: LAST_YEAR },
    places: climatePlaces
  };
  const temporaryFile = `${OUTPUT_FILE}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(output, null, 2)}\n`);
  await rename(temporaryFile, OUTPUT_FILE);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  build().catch((error) => {
    console.error(`Klimadaten wurden nicht aktualisiert: ${error.message}`);
    process.exitCode = 1;
  });
}
