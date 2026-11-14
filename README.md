# Geodaten-Dashboard

Eine statische Webseite mit Karten und Diagrammen zu offenen Geodaten. Für die lokale Nutzung starte im Repository einen Webserver, zum Beispiel mit `python3 -m http.server`, und öffne `http://localhost:8000`. Alternativ kannst du das Repository mit GitHub Pages veröffentlichen.

## Erdbebenkarte

Auf der [Erdbebenkarte](module/erdbeben.html) siehst du Erdbeben weltweit aus den letzten sieben Tagen. Die Kreisgröße zeigt die Magnitude, die Farbe die Tiefe. Mit dem Schieberegler kannst du die Mindestmagnitude ändern; das Balkendiagramm zeigt die Anzahl aller Beben pro Tag. Zeitpunkt und Diagramm nutzen die lokale Zeit des Geräts.

Die Daten kommen direkt aus dem [USGS-GeoJSON-Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson) (gemeinfrei). Die Seite benötigt eine Internetverbindung, um die Daten, Kartenkacheln und Bibliotheken zu laden.

## Kartenauswahl

Auf den Karten kannst du oben rechts zwischen OpenStreetMap, OpenTopoMap, Esri World Imagery und CartoDB Positron wechseln. Die Quellenangaben stehen jeweils direkt auf der Karte. Die zuletzt gewählte Hintergrundkarte wird im Browser gespeichert, sofern dieser das zulässt.

## Klimakarte und Walter-Lieth-Diagramm

Im [Klimamodul](module/klima.html) kannst du Klima-Orte nach Jahresmitteltemperatur, Jahresniederschlag oder Temperaturamplitude einfärben und mit dem Wertebereich filtern. Klicke einen Marker an, suche einen Ort oder wähle einen Punkt auf der Karte. Das Walter-Lieth-Diagramm zeigt die Monatsmitteltemperatur und die mittleren Monatssummen des Niederschlags von 2015 bis 2024. Bis 100 mm gilt das Verhältnis 10 °C zu 20 mm; darüber wird der Niederschlag im Verhältnis 1:10 gestaucht. Erdbeben- und Klima-Layer lassen sich auf der Karte einzeln ein- und ausblenden.

Die Ortsliste steht in `data/orte.json`. `node scripts/build_klimadaten.mjs` lädt Tageswerte aus der [Open-Meteo Archive API](https://open-meteo.com/) für 2015 bis 2024, berechnet die Kennwerte und aktualisiert `data/klimadaten.json`. Das Skript benötigt Node.js 20 und keine zusätzlichen Pakete. Bei einem Fehler oder Rate-Limit bleibt die bisherige Datei erhalten. Die Daten stehen unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Die GitHub Action „Klimadaten aktualisieren“ läuft monatlich und lässt sich auch manuell über `workflow_dispatch` starten. Ortssuche und Kartendaten verwenden [OpenStreetMap](https://www.openstreetmap.org/copyright); Erdbebendaten stammen vom [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson) (gemeinfrei). Die Hintergrundkarten haben ihre Quellenangaben direkt auf der Karte. Eine Internetverbindung ist zum Laden der Daten und Karten erforderlich.
