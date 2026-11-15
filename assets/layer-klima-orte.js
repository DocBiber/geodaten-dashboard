"use strict";

const climateMetrics = {
  annualMeanTemperature_C: { label: "Jahresmitteltemperatur", unit: "°C" },
  annualPrecipitation_mm: { label: "Jahresniederschlag", unit: "mm" },
  temperatureAmplitude_C: { label: "Temperaturamplitude", unit: "°C" }
};

function createClimatePlacesLayer({ controls, statusElement }) {
  const layer = L.layerGroup();
  const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
  const places = [];
  const filterPanel = document.createElement("details");
  filterPanel.className = "climate-map-filter";
  filterPanel.open = true;
  const heading = document.createElement("summary");
  heading.textContent = "Klima-Orte filtern";
  const content = document.createElement("div");
  content.className = "climate-map-filter__content";
  const metricLabel = document.createElement("label");
  metricLabel.textContent = "Kennwert für die Marker-Farbe";
  const metric = document.createElement("select");
  metric.setAttribute("aria-label", "Kennwert für die Marker-Farbe");
  for (const [key, definition] of Object.entries(climateMetrics)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${definition.label} (${definition.unit})`;
    metric.append(option);
  }
  metricLabel.append(metric);
  const sliderContainer = document.createElement("div");
  const count = document.createElement("p");
  count.className = "climate-map-filter__count";
  count.setAttribute("role", "status");
  count.setAttribute("aria-live", "polite");
  const legend = document.createElement("div");
  legend.className = "climate-map-legend";
  const legendHeading = document.createElement("strong");
  const gradient = document.createElement("div");
  gradient.className = "climate-map-legend__gradient";
  const legendLabels = document.createElement("div");
  legendLabels.className = "climate-map-legend__labels";
  const legendMinimum = document.createElement("span");
  const legendMaximum = document.createElement("span");
  legendLabels.append(legendMinimum, legendMaximum);
  legend.append(legendHeading, gradient, legendLabels);
  content.append(metricLabel, sliderContainer, count, legend);
  filterPanel.append(heading, content);
  controls.append(filterPanel);
  L.DomEvent.disableClickPropagation(filterPanel);
  L.DomEvent.disableScrollPropagation(filterPanel);

  function colorForValue(value, minimum, maximum) {
    const colors = [[37, 99, 235], [14, 165, 160], [234, 179, 8], [185, 28, 28]];
    const amount = maximum === minimum ? 0.5 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
    const position = amount * (colors.length - 1);
    const lowerIndex = Math.floor(position);
    const lower = colors[lowerIndex];
    const upper = colors[Math.min(lowerIndex + 1, colors.length - 1)];
    const blend = position - lowerIndex;
    return `rgb(${lower.map((channel, index) =>
      Math.round(channel + (upper[index] - channel) * blend)
    ).join(",")})`;
  }

  function formatMetric(value, metricName = metric.value) {
    return `${numberFormat.format(value)} ${climateMetrics[metricName].unit}`;
  }

  function updateFilter({ minimum, maximum }) {
    const metricName = metric.value;
    const values = places.map((place) => place[metricName]).filter(Number.isFinite);
    const valueMinimum = Math.min(...values);
    const valueMaximum = Math.max(...values);
    const visiblePlaces = places.filter((place) =>
      RangeSlider.isInRange(place[metricName], minimum, maximum)
    );
    layer.clearLayers();
    for (const place of visiblePlaces) {
      const marker = L.circleMarker([place.latitude, place.longitude], {
        radius: 7,
        color: "#172033",
        weight: 1,
        fillColor: colorForValue(place[metricName], valueMinimum, valueMaximum),
        fillOpacity: 0.9,
        bubblingMouseEvents: false
      });
      marker.bindTooltip(`${place.name} (${place.land || "Land unbekannt"}): ${formatMetric(place[metricName])}`);
      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${place.name}${place.land ? `, ${place.land}` : ""}`;
      const details = document.createElement("p");
      details.textContent =
        `Jahresmitteltemperatur: ${formatMetric(place.annualMeanTemperature_C, "annualMeanTemperature_C")} · ` +
        `Jahresniederschlag: ${formatMetric(place.annualPrecipitation_mm, "annualPrecipitation_mm")} · ` +
        `Temperaturamplitude: ${formatMetric(place.temperatureAmplitude_C, "temperatureAmplitude_C")}`;
      const link = document.createElement("a");
      const params = new URLSearchParams({
        lat: String(place.latitude),
        lon: String(place.longitude),
        name: place.name
      });
      link.href = `module/klima.html?${params}`;
      link.className = "button-link";
      link.textContent = "Klimadiagramm ansehen";
      popup.append(title, details, link);
      marker.bindPopup(popup);
      layer.addLayer(marker);
    }

    const definition = climateMetrics[metricName];
    legendHeading.textContent = `Marker-Farbe: ${definition.label}`;
    legendMinimum.textContent = values.length ? formatMetric(valueMinimum) : "–";
    legendMaximum.textContent = values.length ? formatMetric(valueMaximum) : "–";
    count.textContent = `${numberFormat.format(visiblePlaces.length)} von ${numberFormat.format(places.length)} Klima-Orten`;
  }

  const rangeSlider = RangeSlider.createRangeSlider({
    container: sliderContainer,
    minimum: 0,
    maximum: 1,
    initialMinimum: 0,
    initialMaximum: 1,
    formatValue: formatMetric,
    onChange: updateFilter
  });

  function updateMetricBounds() {
    const values = places.map((place) => place[metric.value]).filter(Number.isFinite);
    if (!values.length) return;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    rangeSlider.setBounds(minimum, maximum);
  }

  metric.addEventListener("change", updateMetricBounds);
  statusElement.textContent = "Klimadaten werden geladen …";
  fetch("data/klimadaten.json")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data.places)) throw new Error("Ungültiges Datenformat");
      places.push(...data.places.filter((place) =>
        place.name && Number.isFinite(place.latitude) && Number.isFinite(place.longitude) &&
        Object.keys(climateMetrics).every((key) => Number.isFinite(place[key]))
      ));
      if (!places.length) {
        count.textContent = "0 von 0 Klima-Orten";
        statusElement.textContent = "Die Klimadaten sind noch nicht verfügbar. Bitte versuche es später erneut.";
        statusElement.classList.add("status-error");
        return;
      }
      updateMetricBounds();
      statusElement.textContent = `Klimadaten für ${numberFormat.format(places.length)} Klima-Orte wurden geladen.`;
      statusElement.classList.remove("status-error");
    })
    .catch((error) => {
      console.error("Klimadaten konnten nicht geladen werden.", error);
      count.textContent = "Die Klimadaten konnten nicht geladen werden.";
      statusElement.textContent = "Die Klimadaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung und versuche es später erneut.";
      statusElement.classList.add("status-error");
    });

  return layer;
}
