# Geodaten-Dashboard

Eine statische Webseite mit Karten und Diagrammen zu offenen Geodaten. Für die lokale Nutzung starte im Repository einen Webserver, zum Beispiel mit `python3 -m http.server`, und öffne `http://localhost:8000`. Alternativ kannst du das Repository mit GitHub Pages veröffentlichen.

## Erdbebenkarte

Auf der [Erdbebenkarte](module/erdbeben.html) siehst du Erdbeben weltweit aus den letzten sieben Tagen. Die Kreisgröße zeigt die Magnitude, die Farbe die Tiefe. Mit dem Schieberegler kannst du die Mindestmagnitude ändern; das Balkendiagramm zeigt die Anzahl aller Beben pro Tag. Zeitpunkt und Diagramm nutzen die lokale Zeit des Geräts.

Die Daten kommen direkt aus dem [USGS-GeoJSON-Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson) (gemeinfrei). Die Seite benötigt eine Internetverbindung, um die Daten, Kartenkacheln und Bibliotheken zu laden.

## Kartenauswahl

Auf den Karten kannst du oben rechts zwischen OpenStreetMap, OpenTopoMap, Esri World Imagery und CartoDB Positron wechseln. Die Quellenangaben stehen jeweils direkt auf der Karte. Die zuletzt gewählte Hintergrundkarte wird im Browser gespeichert, sofern dieser das zulässt.

## Klimadiagramm

Im [Klimamodul](module/klima.html) kannst du einen Ort suchen oder direkt auf die Karte klicken. Das Diagramm zeigt die Monatsmitteltemperatur und die mittleren Monatssummen des Niederschlags der letzten fünf vollständigen Kalenderjahre; die Achsen sind im Verhältnis 10 °C zu 20 mm skaliert.

Die Klimadaten stammen von der [Open-Meteo Archive API](https://open-meteo.com/) und stehen unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Die Ortssuche und die Kartendaten verwenden [OpenStreetMap](https://www.openstreetmap.org/copyright). Die Hintergrundkarten haben ihre Quellenangaben direkt auf der Karte. Eine Internetverbindung ist zum Laden der Daten und Karten erforderlich.
