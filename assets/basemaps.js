"use strict";

const basemapStorageKey = "geodaten-dashboard-basemap";
const overlayStorageKey = "geodaten-dashboard-overlays";

function addBasemapControl(map, overlays = {}, defaultOverlays = [], controlContainer) {
  const basemaps = {
    "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>'
    }),
    "OpenTopoMap": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: 'Kartendaten: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>, SRTM | Kartenstil: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    }),
    "Esri World Imagery": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }),
    "CartoDB Positron": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    })
  };
  let selectedBasemap = "OpenStreetMap";
  let selectedOverlays = defaultOverlays.filter((name) => Object.hasOwn(overlays, name));

  try {
    const savedBasemap = localStorage.getItem(basemapStorageKey);
    if (Object.hasOwn(basemaps, savedBasemap)) {
      selectedBasemap = savedBasemap;
    }
    const savedOverlays = localStorage.getItem(overlayStorageKey);
    if (savedOverlays !== null) {
      const parsedOverlays = JSON.parse(savedOverlays);
      if (Array.isArray(parsedOverlays)) {
        selectedOverlays = parsedOverlays.filter((name) => Object.hasOwn(overlays, name));
      }
    }
  } catch (error) {
    console.warn("Die Kartenauswahl kann nicht aus dem Browser geladen werden.", error);
  }

  basemaps[selectedBasemap].addTo(map);
  for (const name of selectedOverlays) {
    overlays[name].addTo(map);
  }

  function saveBasemap(name) {
    try {
      localStorage.setItem(basemapStorageKey, name);
    } catch (error) {
      console.warn("Die gewählte Hintergrundkarte kann nicht gespeichert werden.", error);
    }
  }

  if (controlContainer) {
    const basemapGroup = document.createElement("fieldset");
    const basemapLegend = document.createElement("legend");
    basemapLegend.textContent = "Hintergrundkarten";
    basemapGroup.append(basemapLegend);

    Object.entries(basemaps).forEach(([name, layer], index) => {
      const option = document.createElement("input");
      const label = document.createElement("label");
      option.type = "radio";
      option.name = "basemap-selection";
      option.id = `basemap-option-${index}`;
      option.value = name;
      option.checked = name === selectedBasemap;
      label.htmlFor = option.id;
      label.append(option, document.createTextNode(name));
      basemapGroup.append(label);
      option.addEventListener("change", () => {
        if (!option.checked) {
          return;
        }
        for (const otherLayer of Object.values(basemaps)) {
          map.removeLayer(otherLayer);
        }
        layer.addTo(map);
        saveBasemap(name);
      });
    });
    controlContainer.append(basemapGroup);

    if (Object.keys(overlays).length > 0) {
      const overlayGroup = document.createElement("fieldset");
      const overlayLegend = document.createElement("legend");
      overlayLegend.textContent = "Themenebenen";
      overlayGroup.append(overlayLegend);

      Object.entries(overlays).forEach(([name, layer], index) => {
        const option = document.createElement("input");
        const label = document.createElement("label");
        option.type = "checkbox";
        option.id = `overlay-option-${index}`;
        option.checked = selectedOverlays.includes(name);
        label.htmlFor = option.id;
        label.append(option, document.createTextNode(name));
        overlayGroup.append(label);
        option.addEventListener("change", () => {
          if (option.checked) {
            layer.addTo(map);
          } else {
            map.removeLayer(layer);
          }
          saveOverlays();
        });
      });
      controlContainer.append(overlayGroup);
    }
  } else {
    L.control.layers(basemaps, overlays, { position: "topright" }).addTo(map);
  }

  map.on("baselayerchange", (event) => saveBasemap(event.name));

  function saveOverlays() {
    try {
      const activeOverlays = Object.entries(overlays)
        .filter(([, layer]) => map.hasLayer(layer))
        .map(([name]) => name);
      localStorage.setItem(overlayStorageKey, JSON.stringify(activeOverlays));
    } catch (error) {
      console.warn("Die gewählten Kartenebenen können nicht gespeichert werden.", error);
    }
  }

  map.on("overlayadd overlayremove", saveOverlays);
}
