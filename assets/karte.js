"use strict";

const map = L.map("dashboard-map", { keyboard: true }).setView([25, 10], 2);
const statusElement = document.getElementById("feed-status");
const earthquakes = createEarthquakeLayer({ statusElement });
const climatePlaces = createClimatePlacesLayer({
  controls: document.getElementById("map-layer-controls"),
  statusElement: document.getElementById("climate-data-status")
});
const cities = createCitiesLayer({
  controls: document.getElementById("map-layer-controls"),
  statusElement: document.getElementById("city-data-status")
});

addBasemapControl(
  map,
  {
    "Erdbeben (7 Tage)": earthquakes.layer,
    "Klima-Orte": climatePlaces,
    "Städte": cities
  },
  ["Erdbeben (7 Tage)"],
  document.getElementById("map-layer-controls")
);
