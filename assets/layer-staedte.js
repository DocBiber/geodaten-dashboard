"use strict";

function createCitiesLayer({ controls, statusElement }) {
  const layer = L.layerGroup();
  const numberFormat = new Intl.NumberFormat("de-DE");
  const minimumPopulation = 1;
  let cities = [];
  let maximumPopulation = 1;
  let markers = [];

  const filterPanel = document.createElement("section");
  filterPanel.className = "city-filter";
  filterPanel.setAttribute("aria-labelledby", "city-filter-heading");
  const heading = document.createElement("h3");
  heading.id = "city-filter-heading";
  heading.textContent = "Städte filtern";
  const description = document.createElement("p");
  description.className = "help-text";
  description.textContent = "Einwohnerzahl (logarithmische Skala)";
  const sliderContainer = document.createElement("div");
  const count = document.createElement("p");
  count.className = "city-count";
  count.setAttribute("aria-live", "polite");
  filterPanel.append(heading, description, sliderContainer, count);
  controls.append(filterPanel);

  function updateFilter(minPopulation, maxPopulation) {
    let visibleCount = 0;
    for (const { city, marker } of markers) {
      const visible = city.population >= minPopulation && city.population <= maxPopulation;
      if (visible) {
        visibleCount += 1;
        if (!layer.hasLayer(marker)) {
          layer.addLayer(marker);
        }
      } else if (layer.hasLayer(marker)) {
        layer.removeLayer(marker);
      }
    }
    count.textContent = `${numberFormat.format(visibleCount)} von ${numberFormat.format(markers.length)} Städten`;
  }

  const rangeSlider = RangeSlider.createRangeSlider({
    container: sliderContainer,
    minimum: minimumPopulation,
    maximum: minimumPopulation,
    initialMinimum: minimumPopulation,
    initialMaximum: minimumPopulation,
    logarithmic: true,
    formatValue: (value) => numberFormat.format(value),
    onChange: ({ minimum, maximum }) => updateFilter(minimum, maximum)
  });

  statusElement.textContent = "Städtedaten werden geladen …";
  fetch("data/staedte.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data) || data.some((city) =>
        !city.name || !city.country || !Number.isFinite(city.latitude) ||
        !Number.isFinite(city.longitude) || !Number.isFinite(city.population)
      )) {
        throw new Error("Ungültiges Datenformat");
      }
      cities = data;
      maximumPopulation = Math.max(...cities.map((city) => city.population), minimumPopulation);
      const renderer = L.canvas();
      markers = cities.map((city) => {
        const marker = L.circleMarker([city.latitude, city.longitude], {
          renderer,
          radius: Math.min(13, 3 + Math.log10(city.population) * 1.1),
          color: "#7c2d12",
          weight: 1,
          fillColor: "#f97316",
          fillOpacity: 0.75
        });
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = city.name;
        const details = document.createElement("p");
        details.textContent = `${city.country} · ${numberFormat.format(city.population)} Einwohner`;
        const link = document.createElement("a");
        const params = new URLSearchParams({
          lat: String(city.latitude),
          lon: String(city.longitude),
          name: city.name
        });
        link.href = `module/klima.html?${params}`;
        link.className = "button-link";
        link.textContent = "Klimadiagramm anzeigen";
        popup.append(title, details, link);
        marker.bindPopup(popup);
        return { city, marker };
      });
      statusElement.textContent = "Städtedaten wurden geladen.";
      rangeSlider.setBounds(
        minimumPopulation,
        maximumPopulation,
        Math.min(1_000_000, maximumPopulation),
        maximumPopulation
      );
    })
    .catch((error) => {
      console.error("Städtedaten konnten nicht geladen werden.", error);
      statusElement.textContent = "Die Städtedaten konnten nicht geladen werden. Bitte lade die Seite erneut.";
      statusElement.classList.add("status-error");
    });

  return layer;
}
