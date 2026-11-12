# Geodaten-Dashboard

Eine statische Webseite mit Karten und Diagrammen zu offenen Geodaten. Für die lokale Nutzung starte im Repository einen Webserver, zum Beispiel mit `python3 -m http.server`, und öffne `http://localhost:8000`. Alternativ kannst du das Repository mit GitHub Pages veröffentlichen.

## Erdbebenkarte

Auf der [Erdbebenkarte](module/erdbeben.html) siehst du Erdbeben weltweit aus den letzten sieben Tagen. Die Kreisgröße zeigt die Magnitude, die Farbe die Tiefe. Mit dem Schieberegler kannst du die Mindestmagnitude ändern; das Balkendiagramm zeigt die Anzahl aller Beben pro Tag. Zeitpunkt und Diagramm nutzen die lokale Zeit des Geräts.

Die Daten kommen direkt aus dem [USGS-GeoJSON-Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson) (gemeinfrei). Die Kartenkacheln stammen von [OpenStreetMap](https://www.openstreetmap.org/copyright) und stehen unter der ODbL. Die Seite benötigt eine Internetverbindung, um die Daten, Kartenkacheln und Bibliotheken zu laden.
