"use strict";

(function () {
  const feedUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
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

  window.createEarthquakeLayer = function (options = {}) {
    const layer = L.featureGroup();
    const markers = [];
    const statusElement = options.statusElement;
    const filterElement = options.filterElement;
    const magnitudeValue = options.magnitudeValue;
    const updatedAt = options.updatedAt;
    let totalEarthquakes = 0;
    let loaded = false;
    let minimumMagnitude = Number(options.minimumMagnitude ?? filterElement?.value ?? 0);

    function updateFilter() {
      if (filterElement) {
        minimumMagnitude = Number(filterElement.value);
        if (magnitudeValue) {
          magnitudeValue.value = numberFormat.format(minimumMagnitude);
          magnitudeValue.textContent = numberFormat.format(minimumMagnitude);
        }
      }

      let visibleCount = 0;
      for (const marker of markers) {
        if (marker.earthquakeMagnitude >= minimumMagnitude) {
          if (!layer.hasLayer(marker)) {
            layer.addLayer(marker);
          }
          visibleCount += 1;
        } else {
          layer.removeLayer(marker);
        }
      }

      if (statusElement && loaded) {
        statusElement.textContent = `${numberFormat.format(visibleCount)} von ${numberFormat.format(totalEarthquakes)} Erdbeben werden angezeigt.`;
      }
    }

    if (filterElement) {
      filterElement.addEventListener("input", updateFilter);
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
        loaded = true;

        for (const feature of features) {
          const depth = Number.isFinite(feature.geometry.coordinates[2])
            ? feature.geometry.coordinates[2]
            : 0;
          const marker = L.circleMarker(
            [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
            {
              radius: Math.max(3, feature.properties.mag * 3),
              color: "#fff",
              weight: 1,
              fillColor: colorForDepth(depth),
              fillOpacity: 0.85
            }
          );
          marker.earthquakeMagnitude = feature.properties.mag;
          marker.bindPopup(popupContent(feature, depth));
          markers.push(marker);
        }

        if (typeof options.onDataLoaded === "function") {
          options.onDataLoaded(features);
        }
        updateFilter();
        if (updatedAt) {
          updatedAt.textContent = `Zuletzt geladen: ${timeFormat.format(new Date())} Uhr (lokale Zeit).`;
        }
      } catch (error) {
        console.error("Erdbebendaten konnten nicht geladen werden.", error);
        if (statusElement) {
          statusElement.classList.add("status-error");
          statusElement.textContent = "Die Erdbebendaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung und versuche es später erneut.";
        }
      }
    }

    if (statusElement) {
      statusElement.textContent = "Erdbebendaten werden geladen …";
    }
    const ready = loadEarthquakes();
    return { layer, ready, updateFilter };
  };
})();
