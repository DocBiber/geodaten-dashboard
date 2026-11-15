import assert from "node:assert/strict";
import test from "node:test";
import { fetchPlace, summarizeDailyData } from "../scripts/build_klimadaten.mjs";

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

test("lehnt unvollständige Tagesdaten ab", () => {
  const daily = dailyData();
  daily.precipitation_sum.pop();
  assert.throws(() => summarizeDailyData(place, { daily }), /Ungültige Tagesdaten/);
});

test("wiederholt Open-Meteo-Aufrufe nach HTTP 429 und nutzt die angegebenen Variablen", async () => {
  const originalFetch = globalThis.fetch;
  const places = [
    { name: "Neapel", latitude: 40.8518, longitude: 14.2681 },
    { name: "Reykjavik", latitude: 64.1466, longitude: -21.9426 },
    { name: "Manaus", latitude: -3.119, longitude: -60.0217 }
  ];
  let requests = 0;
  globalThis.fetch = async (url) => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.searchParams.get("start_date"), "2015-01-01");
    assert.equal(requestUrl.searchParams.get("end_date"), "2024-12-31");
    assert.equal(requestUrl.searchParams.get("daily"), "temperature_2m_mean,precipitation_sum");
    requests += 1;
    if (requests === 1) {
      return new Response("", { status: 429, headers: { "Retry-After": "0" } });
    }
    const requestedPlace = places[requests - 2];
    assert.equal(requestUrl.searchParams.get("latitude"), String(requestedPlace.latitude));
    assert.equal(requestUrl.searchParams.get("longitude"), String(requestedPlace.longitude));
    return new Response(JSON.stringify({ daily: dailyData() }));
  };

  try {
    for (const climatePlace of places) {
      const result = await fetchPlace(climatePlace);
      assert.equal(result.annualPrecipitation_mm, 24);
    }
    assert.equal(requests, places.length + 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
