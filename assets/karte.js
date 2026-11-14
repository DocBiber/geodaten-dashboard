"use strict";

const map = L.map("dashboard-map", { keyboard: true }).setView([25, 10], 2);
const statusElement = document.getElementById("feed-status");
const earthquakes = createEarthquakeLayer({ statusElement });
const climatePlaces = createClimatePlacesLayer();

addBasemapControl(
  map,
  {
    "Erdbeben (7 Tage)": earthquakes.layer,
    "Klima-Orte": climatePlaces
  },
  ["Erdbeben (7 Tage)"],
  document.getElementById("map-layer-controls")
);
