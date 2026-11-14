import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourceUrl = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson";
const sourcePath = process.argv[2];

const response = sourcePath
  ? null
  : await fetch(sourceUrl);
if (response && !response.ok) {
  throw new Error(`Natural-Earth-Daten konnten nicht geladen werden: HTTP ${response.status}`);
}

const source = sourcePath
  ? JSON.parse(await readFile(sourcePath, "utf8"))
  : await response.json();

if (!Array.isArray(source.features)) {
  throw new Error("Die Natural-Earth-Datei enthält keine Feature-Liste.");
}

const cities = source.features.flatMap(({ properties = {} }) => {
  const name = String(properties.NAME_DE || properties.NAME || "").trim();
  const country = String(properties.ADM0NAME || "").trim();
  const latitude = Number(properties.LATITUDE);
  const longitude = Number(properties.LONGITUDE);
  const population = Number(properties.POP_MAX);
  if (!name || !country || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
      !Number.isFinite(population) || population <= 0) {
    return [];
  }
  return [{ name, country, latitude, longitude, population }];
});

if (cities.length === 0) {
  throw new Error("Die Natural-Earth-Datei enthält keine gültigen Städte.");
}

const outputPath = new URL("../data/staedte.json", import.meta.url);
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(cities)}\n`);
console.log(`${cities.length} Städte nach data/staedte.json geschrieben.`);
