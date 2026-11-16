import assert from "node:assert/strict";
import test from "node:test";
import { selectClimatePlaces, TARGET_PLACE_COUNT } from "../scripts/build_orte.mjs";

test("behält vorhandene Orte und priorisiert Rasterzellen, Hauptstädte und Einwohner", () => {
  const existing = [{ name: "Bestand", land: "Land", latitude: 0, longitude: 0 }];
  const cities = [
    { name: "Größte Stadt", country: "Land", latitude: 1, longitude: 1, population: 1000 },
    { name: "Kleinere Stadt", country: "Land", latitude: 2, longitude: 2, population: 500 },
    {
      name: "Hauptstadt",
      country: "Land",
      latitude: 3,
      longitude: 3,
      population: 100,
      capital: "primary"
    },
    { name: "Einwohnerstarke Stadt", country: "Land", latitude: 4, longitude: 4, population: 9000 }
  ];

  const selected = selectClimatePlaces(existing, cities, 3);

  assert.equal(selected.length, 3);
  assert.deepEqual(selected.map(({ name }) => name), ["Bestand", "Einwohnerstarke Stadt", "Hauptstadt"]);
  assert.equal(selected[2].land, "Land");
  assert.equal(TARGET_PLACE_COUNT, 2000);
});

test("wählt den größten Ort einer Rasterzelle nur einmal aus", () => {
  const cities = [
    { name: "Klein", country: "Land", latitude: 1, longitude: 1, population: 100 },
    { name: "Groß", country: "Land", latitude: 2, longitude: 2, population: 1000 },
    { name: "Andere Zelle", country: "Land", latitude: 6, longitude: 6, population: 50 }
  ];

  const selected = selectClimatePlaces([], cities);

  assert.deepEqual(selected.map(({ name }) => name), ["Groß", "Andere Zelle", "Klein"]);
});
