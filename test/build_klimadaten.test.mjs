import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildClimateData,
  fetchPlace,
  MAX_PLACES_PER_RUN,
  summarizeDailyData
} from "../scripts/build_klimadaten.mjs";

const place = { name: "Testort", land: "Testland", latitude: 0, longitude: 0 };

function dailyData() {
  const time = [];
  const temperature_2m_mean = [];
  const precipitation_sum = [];
  for (let year = 2015; year <= 2024; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      time.push(`${year}-${String(month).padStart(2, "0")}-15`);
      temperature_2m_mean.push(month - 3);
      precipitation_sum.push(2);
    }
  }
  return { time, temperature_2m_mean, precipitation_sum };
}

test("berechnet Monatsmittel, Monatssummenmittel und Jahreskennwerte", () => {
  const result = summarizeDailyData(place, { elevation: 123, daily: dailyData() });

  assert.equal(result.elevation_m, 123);
  assert.deepEqual(result.monthlyMeanTemperature_C, [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(result.meanMonthlyPrecipitation_mm, Array(12).fill(2));
  assert.equal(result.annualMeanTemperature_C, 3.5);
  assert.equal(result.annualPrecipitation_mm, 24);
  assert.equal(result.temperatureAmplitude_C, 11);
});

test("rundet Monatswerte auf eine Dezimalstelle", () => {
  const daily = dailyData();
  daily.temperature_2m_mean.fill(1.26);
  daily.precipitation_sum.fill(2.26);
  const result = summarizeDailyData(place, { daily });

  assert.deepEqual(result.monthlyMeanTemperature_C, Array(12).fill(1.3));
  assert.deepEqual(result.meanMonthlyPrecipitation_mm, Array(12).fill(2.3));
});

test("lehnt unvollständige Tagesdaten ab", () => {
  const daily = dailyData();
  daily.precipitation_sum.pop();
  assert.throws(() => summarizeDailyData(place, { daily }), /Ungültige Tagesdaten/);
});

test("wiederholt Open-Meteo-Aufrufe bei HTTP 429 nach Retry-After", async () => {
  const originalFetch = globalThis.fetch;
  const requestedPlace = { name: "Neapel", latitude: 40.8518, longitude: 14.2681 };
  let requests = 0;
  const delays = [];
  globalThis.fetch = async (url) => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.searchParams.get("start_date"), "2015-01-01");
    assert.equal(requestUrl.searchParams.get("end_date"), "2024-12-31");
    assert.equal(requestUrl.searchParams.get("daily"), "temperature_2m_mean,precipitation_sum");
    assert.equal(requestUrl.searchParams.get("latitude"), String(requestedPlace.latitude));
    assert.equal(requestUrl.searchParams.get("longitude"), String(requestedPlace.longitude));
    requests += 1;
    if (requests === 1) {
      return new Response("", { status: 429, headers: { "retry-after": "3" } });
    }
    return new Response(JSON.stringify({ daily: dailyData() }), { status: 200 });
  };

  try {
    const result = await fetchPlace(requestedPlace, {
      wait: async (milliseconds) => delays.push(milliseconds)
    });

    assert.equal(requests, 2);
    assert.deepEqual(delays, [3000]);
    assert.equal(result.name, "Neapel");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("beendet wiederholte HTTP-429-Aufrufe nach drei Versuchen", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  const delays = [];
  globalThis.fetch = async () => {
    requests += 1;
    return new Response("", { status: 429 });
  };

  try {
    await assert.rejects(fetchPlace(place, {
      wait: async (milliseconds) => delays.push(milliseconds)
    }), /HTTP 429/);

    assert.equal(requests, 3);
    assert.deepEqual(delays, [60_000, 120_000]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("holt höchstens 90 fehlende Orte und überspringt gespeicherte Orte", async () => {
  const directory = await mkdtemp(join(tmpdir(), "klimadaten-test-"));
  const placesFile = join(directory, "orte.json");
  const outputFile = join(directory, "klimadaten.json");
  const places = Array.from({ length: MAX_PLACES_PER_RUN + 3 }, (_, index) => ({
    ...place,
    name: `Ort ${index}`,
    latitude: index
  }));
  const climateData = {
    source: "Open-Meteo Archive API",
    license: "CC BY 4.0",
    period: { startYear: 2015, endYear: 2024 },
    places: places.slice(0, 3)
  };
  await writeFile(placesFile, JSON.stringify(places));
  await writeFile(outputFile, JSON.stringify(climateData));
  let requests = 0;

  try {
    const result = await buildClimateData({
      placesFile,
      outputFile,
      fetchClimatePlace: async (requestedPlace) => {
        requests += 1;
        return requestedPlace;
      },
      wait: async () => {},
      log: () => {}
    });
    const saved = JSON.parse(await readFile(outputFile, "utf8"));

    assert.equal(requests, MAX_PLACES_PER_RUN);
    assert.equal(result.completed, MAX_PLACES_PER_RUN + 3);
    assert.equal(saved.places.length, MAX_PLACES_PER_RUN + 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("speichert erfolgreiche Abrufe vor einem späteren Dauerfehler", async () => {
  const directory = await mkdtemp(join(tmpdir(), "klimadaten-test-"));
  const placesFile = join(directory, "orte.json");
  const outputFile = join(directory, "klimadaten.json");
  const places = [
    { ...place, name: "Erster Ort" },
    { ...place, name: "Zweiter Ort", latitude: 1 }
  ];
  await writeFile(placesFile, JSON.stringify(places));
  await writeFile(outputFile, JSON.stringify({
    source: "Open-Meteo Archive API",
    license: "CC BY 4.0",
    period: { startYear: 2015, endYear: 2024 },
    places: []
  }));

  try {
    const result = await buildClimateData({
      placesFile,
      outputFile,
      fetchClimatePlace: async (requestedPlace) => {
        if (requestedPlace.name === "Zweiter Ort") throw new Error("HTTP 429");
        return requestedPlace;
      },
      wait: async () => {},
      log: () => {},
      errorLog: () => {}
    });
    const saved = JSON.parse(await readFile(outputFile, "utf8"));

    assert.equal(result.failed, true);
    assert.equal(result.completed, 1);
    assert.deepEqual(saved.places.map(({ name }) => name), ["Erster Ort"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rundet vorhandene Monatswerte auch ohne neue Abrufe", async () => {
  const directory = await mkdtemp(join(tmpdir(), "klimadaten-test-"));
  const placesFile = join(directory, "orte.json");
  const outputFile = join(directory, "klimadaten.json");
  await writeFile(placesFile, JSON.stringify([place]));
  await writeFile(outputFile, JSON.stringify({
    source: "Open-Meteo Archive API",
    license: "CC BY 4.0",
    period: { startYear: 2015, endYear: 2024 },
    places: [{
      ...place,
      monthlyMeanTemperature_C: [1.26],
      meanMonthlyPrecipitation_mm: [2.26]
    }]
  }));
  let requests = 0;

  try {
    const result = await buildClimateData({
      placesFile,
      outputFile,
      fetchClimatePlace: async () => {
        requests += 1;
        return place;
      },
      log: () => {}
    });
    const saved = JSON.parse(await readFile(outputFile, "utf8"));

    assert.equal(result.completed, 1);
    assert.equal(requests, 0);
    assert.deepEqual(saved.places[0].monthlyMeanTemperature_C, [1.3]);
    assert.deepEqual(saved.places[0].meanMonthlyPrecipitation_mm, [2.3]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
