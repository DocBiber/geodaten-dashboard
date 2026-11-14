"use strict";

const climateStatus = document.getElementById("climate-status");
const placeSearch = document.getElementById("place-search");
const placeQuery = document.getElementById("place-query");
const selectedPlace = document.getElementById("selected-place");
const selectedLocationMeta = document.getElementById("selected-location-meta");
const climateSummary = document.getElementById("climate-summary-text");
const climateMap = L.map("climate-map", { keyboard: true }).setView([50, 12], 4);
addBasemapControl(climateMap);

const climateMarkerLayer = L.layerGroup().addTo(climateMap);
const monthLabels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
let climateChart;
let activeController;
let cities = [];
let currentPoint;
const climateCache = new Map();

function coordinatesName(latitude, longitude) {
  return `Koordinaten: ${numberFormat.format(latitude)}° ${latitude >= 0 ? "N" : "S"}, ${numberFormat.format(longitude)}° ${longitude >= 0 ? "O" : "W"}`;
}

function updatePointName(latitude, longitude, name) {
  selectedPlace.textContent = name || (cities.length ? ortsname(latitude, longitude, cities) : coordinatesName(latitude, longitude));
}

function updateLocationMeta(latitude, longitude, elevation) {
  const coordinates = coordinatesName(latitude, longitude);
  const height = elevation === undefined
    ? "Höhe wird geladen …"
    : Number.isFinite(elevation) ? `Höhe: ${numberFormat.format(elevation)} m` : "Höhe: nicht verfügbar";
  selectedLocationMeta.textContent = `${coordinates} · ${height}`;
}

function setClimateStatus(message, isError = false) {
  climateStatus.textContent = message;
  climateStatus.classList.toggle("status-error", isError);
}

function selectPlace(latitude, longitude, name) {
  climateMarkerLayer.clearLayers();
  const marker = L.marker([latitude, longitude], { draggable: true }).addTo(climateMarkerLayer);
  marker.on("dragend", () => {
    const position = marker.getLatLng();
    selectPlace(position.lat, position.lng);
  });
  currentPoint = { latitude, longitude, name };
  updatePointName(latitude, longitude, name);
  updateLocationMeta(latitude, longitude);
  loadClimate(latitude, longitude);
}

async function loadClimate(latitude, longitude) {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const requestLatitude = Number(latitude.toFixed(1));
  const requestLongitude = Number(longitude.toFixed(1));
  const cacheKey = `${requestLatitude},${requestLongitude}`;
  const currentYear = new Date().getFullYear();
  const firstYear = currentYear - 5;
  const lastYear = currentYear - 1;
  const params = new URLSearchParams({
    latitude: String(requestLatitude),
    longitude: String(requestLongitude),
    start_date: `${firstYear}-01-01`,
    end_date: `${lastYear}-12-31`,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: "UTC"
  });

  setClimateStatus(`Klimadaten für ${firstYear} bis ${lastYear} werden geladen …`);
  try {
    const cachedData = climateCache.get(cacheKey);
    if (cachedData) {
      displayClimateData(cachedData, latitude, longitude);
      setClimateStatus("Klimadaten aus dem Zwischenspeicher wurden geladen.");
      return;
    }

    const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (controller.signal.aborted) {
      return;
    }
    const dates = data.daily?.time;
    const temperatures = data.daily?.temperature_2m_mean;
    const precipitation = data.daily?.precipitation_sum;
    if (!Array.isArray(dates) || !Array.isArray(temperatures) || !Array.isArray(precipitation) ||
        dates.length === 0 || dates.length !== temperatures.length || dates.length !== precipitation.length) {
      throw new Error("Ungültiges Datenformat");
    }

    const monthlyTemperatures = Array.from({ length: 12 }, () => []);
    const yearlyPrecipitation = new Map();
    const monthlyPrecipitation = Array.from({ length: 12 }, () => new Map());
    const annualTemperatures = [];

    for (let index = 0; index < dates.length; index += 1) {
      const month = Number(dates[index].slice(5, 7)) - 1;
      const year = Number(dates[index].slice(0, 4));
      const temperature = temperatures[index];
      const rainfall = precipitation[index];
      if (month < 0 || month > 11 || year < firstYear || year > lastYear) {
        continue;
      }
      if (Number.isFinite(temperature)) {
        monthlyTemperatures[month].push(temperature);
        annualTemperatures.push(temperature);
      }
      if (Number.isFinite(rainfall)) {
        yearlyPrecipitation.set(year, (yearlyPrecipitation.get(year) || 0) + rainfall);
        const monthTotals = monthlyPrecipitation[month];
        monthTotals.set(year, (monthTotals.get(year) || 0) + rainfall);
      }
    }

    const monthlyMeans = monthlyTemperatures.map((values) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
    );
    const monthlyRainMeans = monthlyPrecipitation.map((yearTotals) => {
      const values = Array.from(yearTotals.values());
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });
    const annualRainMeans = Array.from(yearlyPrecipitation.values());
    if (!annualTemperatures.length || !annualRainMeans.length ||
        monthlyMeans.some((value) => value === null) || monthlyRainMeans.some((value) => value === null)) {
      throw new Error("Unvollständige Messwerte");
    }

    const annualTemperature = annualTemperatures.reduce((sum, value) => sum + value, 0) / annualTemperatures.length;
    const annualPrecipitation = annualRainMeans.reduce((sum, value) => sum + value, 0) / annualRainMeans.length;
    const climateData = {
      monthlyMeans,
      monthlyRainMeans,
      annualTemperature,
      annualPrecipitation,
      firstYear,
      lastYear,
      elevation: Number.isFinite(data.elevation) ? data.elevation : null
    };
    if (controller.signal.aborted) {
      return;
    }
    climateCache.set(cacheKey, climateData);
    displayClimateData(climateData, latitude, longitude);
    setClimateStatus("Klimadaten wurden geladen.");
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    console.error("Klimadaten konnten nicht geladen werden.", error);
    updateLocationMeta(latitude, longitude, null);
    setClimateStatus("Die Klimadaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung oder wähle einen anderen Ort.", true);
  }
}

function displayClimateData(data, latitude, longitude) {
  climateSummary.textContent = `Jahresmitteltemperatur: ${numberFormat.format(data.annualTemperature)} °C · Jahresniederschlag: ${numberFormat.format(data.annualPrecipitation)} mm · Zeitraum: ${data.firstYear}–${data.lastYear}`;
  updateLocationMeta(latitude, longitude, data.elevation);
  drawClimateChart(data.monthlyMeans, data.monthlyRainMeans);
}

function drawClimateChart(temperatures, precipitation) {
  if (climateChart) {
    climateChart.destroy();
  }

  const temperatureMinimum = Math.floor(Math.min(0, ...temperatures) / 10) * 10;
  const temperatureMaximum = Math.max(temperatureMinimum + 10, Math.ceil(Math.max(...temperatures) / 10) * 10);
  const temperatureRange = temperatureMaximum - temperatureMinimum;
  const precipitationRange = Math.max(...precipitation) / 2;
  const range = Math.ceil(Math.max(temperatureRange, precipitationRange) / 10) * 10;
  const temperatureMaximumForScale = temperatureMinimum + range;

  climateChart = new Chart(document.getElementById("climate-chart"), {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [
        {
          type: "bar",
          label: "Niederschlag (mm)",
          data: precipitation,
          yAxisID: "precipitation",
          backgroundColor: "rgba(23, 105, 170, 0.65)",
          borderColor: "#104b7a",
          borderWidth: 1
        },
        {
          type: "line",
          label: "Temperatur (°C)",
          data: temperatures,
          yAxisID: "temperature",
          borderColor: "#b42318",
          backgroundColor: "#b42318",
          pointRadius: 3,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        temperature: {
          type: "linear",
          position: "left",
          min: temperatureMinimum,
          max: temperatureMaximumForScale,
          ticks: { stepSize: 10 },
          title: { display: true, text: "Temperatur (°C)" }
        },
        precipitation: {
          type: "linear",
          position: "right",
          min: 0,
          max: range * 2,
          ticks: { stepSize: 20 },
          title: { display: true, text: "Niederschlag (mm)" },
          grid: { drawOnChartArea: false }
        },
        x: { title: { display: true, text: "Monat" } }
      },
      plugins: {
        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${numberFormat.format(context.parsed.y)} ${context.dataset.yAxisID === "temperature" ? "°C" : "mm"}` } }
      }
    }
  });
}

climateMap.on("click", (event) => {
  selectPlace(event.latlng.lat, event.latlng.lng);
});

fetch("../data/staedte.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data)) {
      throw new Error("Ungültiges Datenformat");
    }
    cities = data;
    globalThis.staedte = data;
    if (currentPoint && !currentPoint.name) {
      updatePointName(currentPoint.latitude, currentPoint.longitude);
    }
  })
  .catch((error) => console.error("Städtenamen konnten nicht geladen werden.", error));

placeSearch.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = placeQuery.value.trim();
  if (!query) {
    return;
  }

  setClimateStatus("Ort wird gesucht …");
  try {
    const params = new URLSearchParams({ format: "jsonv2", q: query, limit: "1", "accept-language": "de" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const results = await response.json();
    const result = results[0];
    if (!result || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) {
      setClimateStatus("Der Ort wurde nicht gefunden. Prüfe die Schreibweise oder klicke auf die Karte.", true);
      return;
    }

    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    climateMap.setView([latitude, longitude], 8);
    selectPlace(latitude, longitude, result.display_name);
  } catch (error) {
    console.error("Die Ortssuche ist fehlgeschlagen.", error);
    setClimateStatus("Die Ortssuche funktioniert gerade nicht. Bitte versuche es später erneut oder klicke auf die Karte.", true);
  }
});

const placeParameters = new URLSearchParams(window.location.search);
const initialLatitudeParameter = placeParameters.get("lat");
const initialLongitudeParameter = placeParameters.get("lon");
if (initialLatitudeParameter !== null && initialLongitudeParameter !== null) {
  const initialLatitude = Number(initialLatitudeParameter);
  const initialLongitude = Number(initialLongitudeParameter);
  if (Number.isFinite(initialLatitude) && initialLatitude >= -90 && initialLatitude <= 90 &&
      Number.isFinite(initialLongitude) && initialLongitude >= -180 && initialLongitude <= 180) {
    climateMap.setView([initialLatitude, initialLongitude], 8);
    selectPlace(initialLatitude, initialLongitude, placeParameters.get("name"));
  }
}
