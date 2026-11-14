"use strict";

const ORTSNAME_KURZ_KM = 5;
const ORTSNAME_NAEHE_KM = 25;
const ORTSNAME_ERDRADIUS_KM = 6371;
const ORTSNAME_HIMMELSRICHTUNGEN = [
  "nördlich",
  "nordöstlich",
  "östlich",
  "südöstlich",
  "südlich",
  "südwestlich",
  "westlich",
  "nordwestlich"
];

function ortsname(lat, lon, staedte = globalThis.staedte || []) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Array.isArray(staedte) || !staedte.length) {
    return "Unbekannter Ort";
  }

  const radians = (degrees) => degrees * Math.PI / 180;
  const distanceAndBearing = (city) => {
    const latitude = radians(city.latitude);
    const pointLatitude = radians(lat);
    const latitudeDifference = pointLatitude - latitude;
    const longitudeDifference = radians(lon - city.longitude);
    const haversine = Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(latitude) * Math.cos(pointLatitude) * Math.sin(longitudeDifference / 2) ** 2;
    const distance = 2 * ORTSNAME_ERDRADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
    const y = Math.sin(longitudeDifference) * Math.cos(pointLatitude);
    const x = Math.cos(latitude) * Math.sin(pointLatitude) -
      Math.sin(latitude) * Math.cos(pointLatitude) * Math.cos(longitudeDifference);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return { distance, bearing };
  };

  let nearestCity;
  let nearest = { distance: Infinity, bearing: 0 };
  for (const city of staedte) {
    if (!Number.isFinite(city.latitude) || !Number.isFinite(city.longitude) ||
        typeof city.name !== "string" || !city.name) {
      continue;
    }
    const result = distanceAndBearing(city);
    if (result.distance < nearest.distance) {
      nearest = result;
      nearestCity = city;
    }
  }

  if (!nearestCity) {
    return "Unbekannter Ort";
  }
  if (nearest.distance <= ORTSNAME_KURZ_KM) {
    return nearestCity.name;
  }
  if (nearest.distance <= ORTSNAME_NAEHE_KM) {
    return `in der Nähe von ${nearestCity.name}`;
  }
  const direction = ORTSNAME_HIMMELSRICHTUNGEN[Math.round(nearest.bearing / 45) % 8];
  return `${direction} von ${nearestCity.name} (ca. ${Math.round(nearest.distance)} km)`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ortsname };
} else {
  globalThis.ortsname = ortsname;
}
