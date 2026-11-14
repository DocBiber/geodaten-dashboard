import assert from "node:assert/strict";
import test from "node:test";
import ortsnameModule from "../assets/ortsname.js";

const { ortsname } = ortsnameModule;
const heilbronn = { name: "Heilbronn", latitude: 49.1427, longitude: 9.2109 };

function destination(latitude, longitude, distanceKm, bearingDegrees) {
  const radius = 6371;
  const bearing = bearingDegrees * Math.PI / 180;
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeRadians = longitude * Math.PI / 180;
  const angularDistance = distanceKm / radius;
  const destinationLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
    Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const destinationLongitude = longitudeRadians + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
    Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(destinationLatitude)
  );
  return [destinationLatitude * 180 / Math.PI, destinationLongitude * 180 / Math.PI];
}

test("nennt einen Messpunkt direkt in einer Stadt mit dem Stadtnamen", () => {
  assert.equal(ortsname(heilbronn.latitude, heilbronn.longitude, [heilbronn]), "Heilbronn");
});

test("beschreibt einen 15 km entfernten Messpunkt als nahe der Stadt", () => {
  const [latitude, longitude] = destination(heilbronn.latitude, heilbronn.longitude, 15, 90);
  assert.equal(ortsname(latitude, longitude, [heilbronn]), "in der Nähe von Heilbronn");
});

test("gibt für einen 40 km entfernten südwestlichen Punkt Richtung und Abstand an", () => {
  const [latitude, longitude] = destination(heilbronn.latitude, heilbronn.longitude, 40, 225);
  assert.equal(ortsname(latitude, longitude, [heilbronn]), "südwestlich von Heilbronn (ca. 40 km)");
});

test("zeigt auch weit entfernt von Städten den nächsten Ortsbezug", () => {
  assert.match(ortsname(0, 0, [heilbronn]), /^.+ von Heilbronn \(ca\. \d+ km\)$/);
});
