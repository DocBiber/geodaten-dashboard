"use strict";

const feedUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
const statusElement = document.getElementById("feed-status");
const filterElement = document.getElementById("magnitude-filter");
const magnitudeValue = document.getElementById("magnitude-value");
const updatedAt = document.getElementById("updated-at");
const map = L.map("earthquake-map", { keyboard: true }).setView([20, 0], 2);
addBasemapControl(map);

const earthquakeLayer = L.featureGroup().addTo(map);
const earthquakeMarkers = [];
let dailyChart;
let totalEarthquakes = 0;

const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const timeFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short"
});

function colorForDepth(depth) {
  const stops = [
    { depth: 0, color: [29, 78, 216] },
    { depth: 70, color: [8, 145, 178] },
    { depth: 300, color: [234, 179, 8] },
    { depth: 700, color: [185, 28, 28] }
  ];
  const boundedDepth = Math.max(0, Math.min(700, depth));
  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (let index = 1; index < stops.length; index += 1) {
    if (boundedDepth <= stops[index].depth) {
      lower = stops[index - 1];
      upper = stops[index];
      break;
    }
  }

  const position = (boundedDepth - lower.depth) / (upper.depth - lower.depth);
  const rgb = lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * position)
  );
  return `rgb(${rgb.join(",")})`;
}

function markerRadius(magnitude) {
  return Math.max(3, magnitude * 3);
}

function popupContent(feature, depth) {
  const properties = feature.properties;
  const popup = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = properties.place || "Ort nicht angegeben";
  popup.append(title);

  const details = [
    `Magnitude: ${numberFormat.format(properties.mag)}`,
    `Tiefe: ${numberFormat.format(depth)} km`,
    `Zeitpunkt: ${timeFormat.format(new Date(properties.time))} Uhr (lokale Zeit)`
  ];

  for (const text of details) {
    const line = document.createElement("div");
    line.textContent = text;
    popup.append(line);
  }
  return popup;
}

function updateFilter() {
  const minimumMagnitude = Number(filterElement.value);
  magnitudeValue.value = numberFormat.format(minimumMagnitude);
  magnitudeValue.textContent = numberFormat.format(minimumMagnitude);
  let visibleCount = 0;

  for (const layer of earthquakeMarkers) {
    if (layer.earthquakeMagnitude >= minimumMagnitude) {
      if (!earthquakeLayer.hasLayer(layer)) {
        earthquakeLayer.addLayer(layer);
      }
      visibleCount += 1;
    } else {
      earthquakeLayer.removeLayer(layer);
    }
  }

  statusElement.textContent = `${numberFormat.format(visibleCount)} von ${numberFormat.format(totalEarthquakes)} Erdbeben werden angezeigt.`;
}

function createDailyChart(features) {
  const counts = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    counts.set(day.toLocaleDateString("de-DE"), 0);
  }

  for (const feature of features) {
    const day = new Date(feature.properties.time).toLocaleDateString("de-DE");
    if (counts.has(day)) {
      counts.set(day, counts.get(day) + 1);
    }
  }

  const labels = Array.from(counts.keys());
  dailyChart = new Chart(document.getElementById("daily-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Erdbeben",
        data: Array.from(counts.values()),
        backgroundColor: "#1769aa",
        borderColor: "#104b7a",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Datum (lokale Zeit)" } },
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Anzahl" } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.parsed.y} Erdbeben` } }
      }
    }
  });
}

async function loadEarthquakes() {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.features)) {
      throw new Error("Ungültiges Datenformat");
    }

    const features = data.features.filter((feature) =>
      feature &&
      feature.geometry?.type === "Point" &&
      Array.isArray(feature.geometry.coordinates) &&
      Number.isFinite(feature.geometry.coordinates[0]) &&
      Number.isFinite(feature.geometry.coordinates[1]) &&
      Number.isFinite(feature.properties?.mag) &&
      Number.isFinite(feature.properties?.time)
    );
    totalEarthquakes = features.length;

    for (const feature of features) {
      const depth = Number.isFinite(feature.geometry.coordinates[2])
        ? feature.geometry.coordinates[2]
        : 0;
      const layer = L.circleMarker(
        [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
        {
          radius: markerRadius(feature.properties.mag),
          color: "#fff",
          weight: 1,
          fillColor: colorForDepth(depth),
          fillOpacity: 0.85
        }
      );
      layer.earthquakeMagnitude = feature.properties.mag;
      layer.bindPopup(popupContent(feature, depth));
      earthquakeMarkers.push(layer);
    }

    createDailyChart(features);
    updateFilter();
    updatedAt.textContent = `Zuletzt geladen: ${timeFormat.format(new Date())} Uhr (lokale Zeit).`;
  } catch (error) {
    console.error("Erdbebendaten konnten nicht geladen werden.", error);
    statusElement.classList.add("status-error");
    statusElement.textContent = "Die Erdbebendaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung und versuche es später erneut.";
  }
}

filterElement.addEventListener("input", updateFilter);
loadEarthquakes();
