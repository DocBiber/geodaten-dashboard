"use strict";

function createCitiesLayer({ controls, statusElement }) {
  const layer = L.layerGroup();
  const numberFormat = new Intl.NumberFormat("de-DE");
  const sliderSteps = 10000;
  const minimumPopulation = 1;
  let cities = [];
  let maximumPopulation = 1;
  let lowerValue = 0;
  let upperValue = sliderSteps;
  let markers = [];

  const populationAt = (value) => Math.round(
    minimumPopulation * (maximumPopulation / minimumPopulation) ** (value / sliderSteps)
  );
  const sliderAt = (population) =>
    Math.log(population / minimumPopulation) / Math.log(maximumPopulation / minimumPopulation) * sliderSteps;

  const filterPanel = document.createElement("section");
  filterPanel.className = "city-filter";
  filterPanel.setAttribute("aria-labelledby", "city-filter-heading");
  const heading = document.createElement("h3");
  heading.id = "city-filter-heading";
  heading.textContent = "Städte filtern";
  const description = document.createElement("p");
  description.className = "help-text";
  description.textContent = "Einwohnerzahl (logarithmische Skala)";
  const slider = document.createElement("div");
  slider.className = "city-slider";
  const lower = document.createElement("input");
  lower.type = "range";
  lower.min = "0";
  lower.max = String(sliderSteps);
  lower.step = "any";
  lower.value = "0";
  lower.setAttribute("aria-label", "Mindestens so viele Einwohner");
  lower.className = "city-slider-lower";
  const upper = document.createElement("input");
  upper.type = "range";
  upper.min = "0";
  upper.max = String(sliderSteps);
  upper.step = "any";
  upper.value = String(sliderSteps);
  upper.setAttribute("aria-label", "Höchstens so viele Einwohner");
  upper.className = "city-slider-upper";
  slider.append(lower, upper);
  const rangeLabel = document.createElement("p");
  rangeLabel.className = "city-range-label";
  const lowerOutput = document.createElement("span");
  const upperOutput = document.createElement("span");
  rangeLabel.append("Von ", lowerOutput, " bis ", upperOutput, " Einwohner");
  const count = document.createElement("p");
  count.className = "city-count";
  count.setAttribute("aria-live", "polite");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Zurücksetzen";
  filterPanel.append(heading, description, slider, rangeLabel, count, reset);
  controls.append(filterPanel);

  function updateFilter() {
    const minPopulation = populationAt(lowerValue);
    const maxPopulation = populationAt(upperValue);
    lowerOutput.textContent = numberFormat.format(minPopulation);
    upperOutput.textContent = numberFormat.format(maxPopulation);
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
    count.textContent = `${numberFormat.format(visibleCount)} Städte`;
  }

  lower.addEventListener("input", () => {
    lowerValue = Math.min(Number(lower.value), upperValue);
    lower.value = String(lowerValue);
    updateFilter();
  });
  upper.addEventListener("input", () => {
    upperValue = Math.max(Number(upper.value), lowerValue);
    upper.value = String(upperValue);
    updateFilter();
  });
  reset.addEventListener("click", () => {
    lowerValue = Math.min(sliderAt(1_000_000), sliderSteps);
    upperValue = sliderSteps;
    lower.value = String(lowerValue);
    upper.value = String(upperValue);
    updateFilter();
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
      lowerValue = Math.min(sliderAt(1_000_000), sliderSteps);
      lower.value = String(lowerValue);
      upperValue = sliderSteps;
      upper.value = String(upperValue);
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
      updateFilter();
    })
    .catch((error) => {
      console.error("Städtedaten konnten nicht geladen werden.", error);
      statusElement.textContent = "Die Städtedaten konnten nicht geladen werden. Bitte lade die Seite erneut.";
      statusElement.classList.add("status-error");
    });

  return layer;
}
