"use strict";

const climateStatus = document.getElementById("climate-status");
const placeSearch = document.getElementById("place-search");
const placeQuery = document.getElementById("place-query");
const selectedPlace = document.getElementById("selected-place");
const climateSummary = document.getElementById("climate-summary-text");
const climateMetric = document.getElementById("climate-metric");
const minimumInput = document.getElementById("climate-min");
const maximumInput = document.getElementById("climate-max");
const climateCount = document.getElementById("climate-count");
const climateMap = L.map("climate-map", { keyboard: true }).setView([20, 0], 2);
addBasemapControl(climateMap);

const climateLayer = L.layerGroup().addTo(climateMap);
const earthquakeLayer = L.layerGroup();
L.control.layers(null, { "Klima-Orte": climateLayer, Erdbeben: earthquakeLayer }).addTo(climateMap);

const monthLabels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const METRICS = {
  annualMeanTemperature_C: { unit: "°C", name: "Jahresmitteltemperatur" },
  annualPrecipitation_mm: { unit: "mm", name: "Jahresniederschlag" },
  temperatureAmplitude_C: { unit: "°C", name: "Temperaturamplitude" }
};
let climatePlaces = [];
let climateChart;
let activeRequest = 0;

function setClimateStatus(message, isError = false) {
  climateStatus.textContent = message;
  climateStatus.classList.toggle("status-error", isError);
}

function climateColor(value, minimum, maximum) {
  const amount = maximum === minimum ? 0.5 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  const colors = [[37, 99, 235], [14, 165, 160], [234, 179, 8], [185, 28, 28]];
  const position = amount * (colors.length - 1);
  const lowerIndex = Math.floor(position);
  const lower = colors[lowerIndex];
  const upper = colors[Math.min(lowerIndex + 1, colors.length - 1)];
  const blend = position - lowerIndex;
  return `rgb(${lower.map((channel, index) => Math.round(channel + (upper[index] - channel) * blend)).join(",")})`;
}

function setFilterBounds(reset = false) {
  const values = climatePlaces.map((place) => place[climateMetric.value]).filter(Number.isFinite);
  if (!values.length) return;
  const bounds = {
    minimum: Math.floor(Math.min(...values) * 10) / 10,
    maximum: Math.ceil(Math.max(...values) * 10) / 10
  };
  const step = Math.max(0.1, Math.ceil((bounds.maximum - bounds.minimum) / 100 * 10) / 10);
  for (const input of [minimumInput, maximumInput]) {
    input.min = String(bounds.minimum);
    input.max = String(bounds.maximum);
    input.step = String(step);
  }
  if (reset) {
    minimumInput.value = String(bounds.minimum);
    maximumInput.value = String(bounds.maximum);
  } else {
    minimumInput.value = String(Math.max(bounds.minimum, Math.min(bounds.maximum, Number(minimumInput.value))));
    maximumInput.value = String(Math.max(bounds.minimum, Math.min(bounds.maximum, Number(maximumInput.value))));
    if (Number(minimumInput.value) > Number(maximumInput.value)) {
      minimumInput.value = maximumInput.value;
    }
  }
}

function updateClimateLayer() {
  if (!climatePlaces.length) return;
  const metric = climateMetric.value;
  const values = climatePlaces.map((place) => place[metric]).filter(Number.isFinite);
  const valueMinimum = Math.min(...values);
  const valueMaximum = Math.max(...values);
  const filterMinimum = Number(minimumInput.value);
  const filterMaximum = Number(maximumInput.value);
  const visiblePlaces = climatePlaces.filter((place) =>
    Number.isFinite(place[metric]) && place[metric] >= filterMinimum && place[metric] <= filterMaximum
  );

  climateLayer.clearLayers();
  for (const place of visiblePlaces) {
    const marker = L.circleMarker([place.latitude, place.longitude], {
      radius: 7,
      color: "#172033",
      weight: 1,
      fillColor: climateColor(place[metric], valueMinimum, valueMaximum),
      fillOpacity: 0.9,
      bubblingMouseEvents: false
    });
    marker.bindTooltip(`${place.name} (${place.land}): ${numberFormat.format(place[metric])} ${METRICS[metric].unit}`);
    marker.on("click", () => showPlace(place));
    climateLayer.addLayer(marker);
  }

  const unit = METRICS[metric].unit;
  document.getElementById("climate-min-value").textContent = `${numberFormat.format(filterMinimum)} ${unit}`;
  document.getElementById("climate-max-value").textContent = `${numberFormat.format(filterMaximum)} ${unit}`;
  climateCount.textContent = `${visiblePlaces.length} von ${climatePlaces.length} Orten werden angezeigt.`;
}

function showPlace(place) {
  activeRequest += 1;
  selectedPlace.textContent = `${place.name}, ${place.land || "Land unbekannt"}`;
  climateSummary.textContent =
    `Höhe: ${Number.isFinite(place.elevation_m) ? `${numberFormat.format(place.elevation_m)} m` : "keine Angabe"} · ` +
    `Jahresmitteltemperatur: ${numberFormat.format(place.annualMeanTemperature_C)} °C · ` +
    `Jahresniederschlag: ${numberFormat.format(place.annualPrecipitation_mm)} mm · Zeitraum: 2015–2024`;
  drawClimateChart(place.monthlyMeanTemperature_C, place.meanMonthlyPrecipitation_mm);
  setClimateStatus("Klimadiagramm für den ausgewählten Ort.");
}

function precipitationScale(value) {
  return value <= 100 ? value / 2 : 50 + (value - 100) / 10;
}

function precipitationFromScale(value) {
  return value <= 50 ? value * 2 : 100 + (value - 50) * 10;
}

const highRainfallPlugin = {
  id: "highRainfallArea",
  beforeDatasetsDraw(chart) {
    const precipitation = chart.data.rawPrecipitation;
    const points = chart.getDatasetMeta(1).data;
    const threshold = chart.scales.y.getPixelForValue(50);
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.fillStyle = "rgba(12, 57, 110, 0.72)";
    for (let index = 0; index < precipitation.length; index += 1) {
      if (precipitation[index] <= 100 || !points[index]) continue;
      const { x, y } = points[index].getProps(["x", "y"], true);
      const left = index === 0 ? chartArea.left : (points[index - 1].x + x) / 2;
      const right = index === points.length - 1 ? chartArea.right : (x + points[index + 1].x) / 2;
      ctx.fillRect(left, Math.max(y, chartArea.top), right - left, Math.max(0, threshold - Math.max(y, chartArea.top)));
    }
    ctx.restore();
  }
};

function drawClimateChart(temperatures, precipitation) {
  if (!Array.isArray(temperatures) || temperatures.length !== 12 ||
      !Array.isArray(precipitation) || precipitation.length !== 12) {
    setClimateStatus("Für diesen Ort fehlen Monatswerte.", true);
    return;
  }
  if (climateChart) climateChart.destroy();

  const normalizedPrecipitation = precipitation.map(precipitationScale);
  const allValues = [...temperatures, ...normalizedPrecipitation];
  const minimum = Math.floor(Math.min(0, ...allValues) / 10) * 10;
  const maximum = Math.ceil(Math.max(10, ...allValues) / 10) * 10;
  climateChart = new Chart(document.getElementById("climate-chart"), {
    type: "line",
    plugins: [highRainfallPlugin],
    data: {
      labels: monthLabels,
      rawPrecipitation: precipitation,
      datasets: [
        {
          label: "Temperatur (°C)",
          data: temperatures,
          borderColor: "#b42318",
          backgroundColor: "#b42318",
          pointRadius: 3,
          tension: 0.15
        },
        {
          label: "Niederschlag (mm)",
          data: normalizedPrecipitation,
          yAxisID: "precipitation",
          borderColor: "#1769aa",
          backgroundColor: "#1769aa",
          pointRadius: 3,
          tension: 0.15,
          fill: { target: "-1", above: "rgba(23, 105, 170, 0.25)", below: "rgba(180, 35, 24, 0.16)" }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: {
          min: minimum,
          max: maximum,
          ticks: { stepSize: 10 },
          title: { display: true, text: "Temperatur (°C)" }
        },
        precipitation: {
          position: "right",
          min: minimum,
          max: maximum,
          grid: { drawOnChartArea: false },
          ticks: {
            stepSize: 10,
            callback: (value) => value < 0 ? "" : numberFormat.format(precipitationFromScale(Number(value)))
          },
          title: { display: true, text: "Niederschlag (mm)" }
        },
        x: { title: { display: true, text: "Monat" } }
      },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (context) => {
              const isPrecipitation = context.datasetIndex === 1;
              const value = isPrecipitation
                ? precipitation[context.dataIndex]
                : context.parsed.y;
              return `${context.dataset.label}: ${numberFormat.format(value)} ${isPrecipitation ? "mm" : "°C"}`;
            }
          }
        }
      }
    }
  });
}

function summarizeLiveData(data) {
  const dates = data.daily?.time;
  const temperatures = data.daily?.temperature_2m_mean;
  const rainfall = data.daily?.precipitation_sum;
  if (!Array.isArray(dates) || !Array.isArray(temperatures) || !Array.isArray(rainfall) ||
      !dates.length || dates.length !== temperatures.length || dates.length !== rainfall.length) {
    throw new Error("Ungültiges Datenformat");
  }

  const monthlyTemperatures = Array.from({ length: 12 }, () => []);
  const monthlyRainfall = Array.from({ length: 12 }, () => new Map());
  const annualTemperatures = [];
  const annualRainfall = new Map();
  for (let index = 0; index < dates.length; index += 1) {
    const month = Number(dates[index].slice(5, 7)) - 1;
    const year = Number(dates[index].slice(0, 4));
    if (month < 0 || month > 11) continue;
    if (Number.isFinite(temperatures[index])) {
      monthlyTemperatures[month].push(temperatures[index]);
      annualTemperatures.push(temperatures[index]);
    }
    if (Number.isFinite(rainfall[index])) {
      annualRainfall.set(year, (annualRainfall.get(year) || 0) + rainfall[index]);
      monthlyRainfall[month].set(year, (monthlyRainfall[month].get(year) || 0) + rainfall[index]);
    }
  }

  const monthlyMeanTemperature = monthlyTemperatures.map((values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  );
  const meanMonthlyPrecipitation = monthlyRainfall.map((totals) => {
    const values = [...totals.values()];
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  });
  if (monthlyMeanTemperature.some((value) => value === null) ||
      meanMonthlyPrecipitation.some((value) => value === null) || !annualTemperatures.length) {
    throw new Error("Unvollständige Messwerte");
  }
  return {
    monthlyMeanTemperature_C: monthlyMeanTemperature,
    meanMonthlyPrecipitation_mm: meanMonthlyPrecipitation,
    annualMeanTemperature_C: annualTemperatures.reduce((sum, value) => sum + value, 0) / annualTemperatures.length,
    annualPrecipitation_mm: [...annualRainfall.values()].reduce((sum, value) => sum + value, 0) / annualRainfall.size
  };
}

async function loadClimate(latitude, longitude, name) {
  const requestId = ++activeRequest;
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: "2015-01-01",
    end_date: "2024-12-31",
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: "UTC"
  });
  setClimateStatus("Klimadaten für 2015 bis 2024 werden geladen …");
  try {
    const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${parameters}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const summary = summarizeLiveData(data);
    if (requestId !== activeRequest) return;
    const livePlace = {
      ...summary,
      name,
      land: "Kartenpunkt",
      elevation_m: Number.isFinite(data.elevation) ? data.elevation : null
    };
    showPlace(livePlace);
  } catch (error) {
    if (requestId !== activeRequest) return;
    console.error("Klimadaten konnten nicht geladen werden.", error);
    setClimateStatus("Die Klimadaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung oder wähle einen anderen Ort.", true);
  }
}

async function loadEarthquakes() {
  try {
    const response = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.features)) throw new Error("Ungültiges Datenformat");
    for (const feature of data.features) {
      const coordinates = feature.geometry?.coordinates;
      if (feature.geometry?.type !== "Point" || !Array.isArray(coordinates) ||
          !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) continue;
      const magnitude = Number.isFinite(feature.properties?.mag) ? feature.properties.mag : 0;
      const marker = L.circleMarker([coordinates[1], coordinates[0]], {
        radius: Math.max(3, magnitude * 2),
        color: "#fff",
        weight: 1,
        fillColor: "#b42318",
        fillOpacity: 0.8
      });
      marker.bindTooltip(feature.properties?.place || "Erdbeben");
      earthquakeLayer.addLayer(marker);
    }
  } catch (error) {
    console.warn("Erdbebendaten konnten nicht geladen werden.", error);
  }
}

async function loadClimatePlaces() {
  try {
    const response = await fetch("../data/klimadaten.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    climatePlaces = Array.isArray(data.places)
      ? data.places.filter((place) =>
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude) &&
        Number.isFinite(place.annualMeanTemperature_C) &&
        Number.isFinite(place.annualPrecipitation_mm) &&
        Number.isFinite(place.temperatureAmplitude_C) &&
        place.monthlyMeanTemperature_C?.length === 12 &&
        place.meanMonthlyPrecipitation_mm?.length === 12
      )
      : [];
    if (!climatePlaces.length) {
      climateCount.textContent = "0 von 0 Orten werden angezeigt.";
      setClimateStatus("Die vorberechneten Klimadaten sind noch nicht verfügbar. Du kannst einen Ort suchen oder auf die Karte klicken.", true);
      return;
    }
    climateMap.addLayer(climateLayer);
    setFilterBounds(true);
    updateClimateLayer();
    setClimateStatus(`Klimadaten für ${climatePlaces.length} Orte wurden geladen.`);
  } catch (error) {
    console.error("Die vorberechneten Klimadaten konnten nicht geladen werden.", error);
    climateCount.textContent = "Die Klimadaten konnten nicht geladen werden.";
    setClimateStatus("Die vorberechneten Klimadaten konnten nicht geladen werden. Du kannst einen Ort suchen oder auf die Karte klicken.", true);
  }
}

climateMetric.addEventListener("change", () => {
  setFilterBounds(true);
  updateClimateLayer();
});
minimumInput.addEventListener("input", () => {
  if (Number(minimumInput.value) > Number(maximumInput.value)) maximumInput.value = minimumInput.value;
  updateClimateLayer();
});
maximumInput.addEventListener("input", () => {
  if (Number(maximumInput.value) < Number(minimumInput.value)) minimumInput.value = maximumInput.value;
  updateClimateLayer();
});
document.getElementById("reset-climate-filter").addEventListener("click", () => {
  setFilterBounds(true);
  updateClimateLayer();
});

climateMap.on("click", (event) => {
  loadClimate(event.latlng.lat, event.latlng.lng, `Koordinaten: ${numberFormat.format(event.latlng.lat)}°, ${numberFormat.format(event.latlng.lng)}°`);
});

placeSearch.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = placeQuery.value.trim();
  if (!query) return;
  setClimateStatus("Ort wird gesucht …");
  try {
    const parameters = new URLSearchParams({ format: "jsonv2", q: query, limit: "1", "accept-language": "de" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const results = await response.json();
    const result = results[0];
    if (!result || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) {
      setClimateStatus("Der Ort wurde nicht gefunden. Prüfe die Schreibweise oder klicke auf die Karte.", true);
      return;
    }
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    climateMap.setView([latitude, longitude], 8);
    loadClimate(latitude, longitude, result.name || result.display_name);
  } catch (error) {
    console.error("Die Ortssuche ist fehlgeschlagen.", error);
    setClimateStatus("Die Ortssuche funktioniert gerade nicht. Bitte versuche es später erneut oder klicke auf die Karte.", true);
  }
});

loadClimatePlaces();
loadEarthquakes();
