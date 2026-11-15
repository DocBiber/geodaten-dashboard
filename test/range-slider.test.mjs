import assert from "node:assert/strict";
import test from "node:test";
import rangeSlider from "../assets/range-slider.js";

const { isInRange, resetRange, scaleToValue, valueToScale, valuesInRange } = rangeSlider;

test("Filtergrenzen sind inklusive und Werte außerhalb bleiben verborgen", () => {
  assert.equal(isInRange(10, 10, 20), true);
  assert.equal(isInRange(20, 10, 20), true);
  assert.equal(isInRange(9, 10, 20), false);
  assert.equal(isInRange(21, 10, 20), false);
});

test("ein leerer oder ungültiger Wertebereich liefert keine Treffer", () => {
  assert.deepEqual(valuesInRange([1, 2, 3], 4, 2), []);
  assert.deepEqual(valuesInRange([], 0, 10), []);
  assert.equal(isInRange("2", 1, 3), false);
});

test("logarithmische Skala rechnet Zahlenwerte in beide Richtungen um", () => {
  assert.equal(scaleToValue(0, 1, 1000000, true), 1);
  assert.equal(scaleToValue(10000, 1, 1000000, true), 1000000);
  assert.ok(Math.abs(scaleToValue(5000, 1, 1000000, true) - 1000) < 1e-8);
  assert.equal(scaleToValue(5000, 1, 10000, true), 100);
  assert.equal(valueToScale(1000, 1, 1000000, true), 5000);
});

test("lineare Skala bildet auch negative Werte korrekt ab", () => {
  assert.equal(scaleToValue(0, -20, 20), -20);
  assert.equal(scaleToValue(5000, -20, 20), 0);
  assert.equal(scaleToValue(10000, -20, 20), 20);
});

test("Zurücksetzen stellt die ursprünglichen Grenzen wieder her", () => {
  assert.deepEqual(resetRange(1000000, 35676000), { minimum: 1000000, maximum: 35676000 });
});
