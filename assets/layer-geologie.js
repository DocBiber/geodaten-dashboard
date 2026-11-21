"use strict";

(function () {
  const plateUrl = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json";
  const vulnerabilityUrl = "https://raw.githubusercontent.com/KidlanLi/GovTech/main/data/cleaned_UND_NDGAIN.csv";
  const tileOptions = {
    maxZoom: 12,
    attribution: 'Höhenrelief: <a href="https://www.arcgis.com">Esri</a> | Höhenlinien: <a href="https://opentopomap.org">OpenTopoMap</a>'
  };

  function vulnerabilityColor(value) {
    if (value < 0.33) return "#facc15";
    if (value < 0.66) return "#dc2626";
    return "#7e22ce";
  }

  function parseCsv(text) {
    const [header, ...rows] = text.trim().split(/\r?\n/);
    const columns = header.split(",").map((column) => column.trim().toLowerCase());
    const countryColumn = columns.findIndex((column) => column.includes("country"));
    const scoreColumn = columns.findIndex((column) => column.includes("vulnerability index"));
    if (countryColumn < 0 || scoreColumn < 0) throw new Error("Ungültiges Vulnerabilitätsformat");
    return rows.map((row) => {
      const values = row.split(",");
      return {
        country: values[countryColumn]?.replace(/^"|"$/g, "").trim(),
        value: Number(values[scoreColumn])
      };
    }).filter((entry) => entry.country && Number.isFinite(entry.value));
  }

  window.createGeologyLayers = function ({ map, controls, statusElement }) {
    const vulnerability = L.layerGroup();
    const plates = L.featureGroup();
    const hillshade = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
      { ...tileOptions, maxZoom: 16, opacity: 0.55 }
    );
    const contours = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      { ...tileOptions, opacity: 0.55, subdomains: "abc" }
    );
    const contoursLabeled = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      { ...tileOptions, opacity: 0.8, subdomains: "abc" }
    );
    const contourSelection = document.createElement("label");
    contourSelection.className = "contour-selection";
    contourSelection.textContent = "Höhenlinien auswählen";
    const contourSelect = document.createElement("select");
    contourSelect.setAttribute("aria-label", "Art der Höhenlinien");
    [["all", "Alle Linien"], ["labeled", "Beschriftete Linien"]].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      contourSelect.append(option);
    });
    contourSelection.append(contourSelect);
    contourSelect.addEventListener("change", () => {
      if (!map.hasLayer(contours) && !map.hasLayer(contoursLabeled)) return;
      map.removeLayer(contours);
      map.removeLayer(contoursLabeled);
      map.addLayer(contourSelect.value === "all" ? contours : contoursLabeled);
    });

    function addLegend() {
      const legend = document.createElement("section");
      legend.className = "map-layer-legend";
      legend.setAttribute("aria-label", "Legende der zusätzlichen Kartenebenen");
      legend.innerHTML = "<strong>Legende</strong><span><i class=\"legend-swatch vulnerability-low\"></i> niedrig</span><span><i class=\"legend-swatch vulnerability-medium\"></i> mittel</span><span><i class=\"legend-swatch vulnerability-high\"></i> hoch</span><span><i class=\"plate-line plate-convergent\"></i> konvergent</span><span><i class=\"plate-line plate-divergent\"></i> divergent</span><span><i class=\"plate-line plate-transform\"></i> Horizontalverschiebung</span><span><i class=\"plate-line plate-unknown\"></i> unklar</span>";
      controls.append(legend);
    }

    function loadVulnerability() {
      return fetch(vulnerabilityUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((text) => {
          const scores = new Map(parseCsv(text).map((entry) => [entry.country.toLowerCase(), entry.value]));
          return fetch("data/staedte.json").then((response) => response.json()).then((cities) => {
            for (const city of cities) {
              const value = scores.get(city.country.toLowerCase());
              if (!Number.isFinite(value)) continue;
              const marker = L.circleMarker([city.latitude, city.longitude], {
                radius: 5, color: "#172033", weight: 1, fillColor: vulnerabilityColor(value), fillOpacity: 0.8
              });
              marker.bindTooltip(`${city.name}: Vulnerabilität ${value.toFixed(2)}`);
              vulnerability.addLayer(marker);
            }
          });
        });
    }

    fetch(plateUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        L.geoJSON(data, {
          style: (feature) => {
            const type = String(feature.properties?.Type || feature.properties?.type || "").toLowerCase();
            return {
              color: type.includes("conver") ? "#dc2626" :
                type.includes("diverg") ? "#2563eb" :
                  type.includes("transform") ? "#16a34a" : "#64748b",
              weight: 2,
              dashArray: type.includes("transform") ? "6 4" : undefined
            };
          },
          onEachFeature: (feature, layer) => {
            const type = feature.properties?.Type || feature.properties?.type || "unklar";
            layer.bindTooltip(`Plattengrenze: ${type}`);
          }
        }).eachLayer((layer) => plates.addLayer(layer));
      })
      .catch((error) => console.warn("Plattengrenzen konnten nicht geladen werden.", error));

    loadVulnerability().catch((error) => {
      console.warn("Vulnerabilitätsdaten konnten nicht geladen werden.", error);
      if (statusElement) statusElement.textContent = "Einige Zusatzdaten konnten nicht geladen werden.";
    });

    if (controls) {
      controls.append(contourSelection);
      addLegend();
    }
    return { vulnerability, hillshade, contours, contoursLabeled, plates };
  };
})();
