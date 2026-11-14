"use strict";

function createClimatePlacesLayer() {
  const places = [
    { name: "Berlin", latitude: 52.52, longitude: 13.405 },
    { name: "Reykjavík", latitude: 64.1466, longitude: -21.9426 },
    { name: "Kairo", latitude: 30.0444, longitude: 31.2357 },
    { name: "Quito", latitude: -0.1807, longitude: -78.4678 },
    { name: "Manaus", latitude: -3.119, longitude: -60.0217 },
    { name: "Singapur", latitude: 1.3521, longitude: 103.8198 },
    { name: "Tokio", latitude: 35.6762, longitude: 139.6503 },
    { name: "Perth", latitude: -31.9505, longitude: 115.8605 }
  ];
  const layer = L.layerGroup();

  for (const place of places) {
    const marker = L.marker([place.latitude, place.longitude]);
    const popup = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = place.name;
    const link = document.createElement("a");
    const params = new URLSearchParams({
      lat: String(place.latitude),
      lon: String(place.longitude),
      name: place.name
    });
    link.href = `module/klima.html?${params}`;
    link.textContent = "Walter-Lieth-Diagramm ansehen";
    popup.append(title, document.createElement("br"), link);
    marker.bindPopup(popup);
    marker.addTo(layer);
  }

  return layer;
}
