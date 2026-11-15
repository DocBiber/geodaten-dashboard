import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDailyData } from "../scripts/build_klimadaten.mjs";

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
