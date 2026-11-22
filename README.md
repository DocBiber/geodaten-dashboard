# Geodaten-Dashboard

Eine statische Webseite mit Karten und Diagrammen zu offenen Geodaten. Für die lokale Nutzung starte im Repository einen Webserver, zum Beispiel mit `python3 -m http.server`, und öffne `http://localhost:8000`. Alternativ kannst du das Repository mit GitHub Pages veröffentlichen.

## Erdbebenkarte

Auf der [Erdbebenkarte](module/erdbeben.html) siehst du Erdbeben weltweit aus den letzten sieben Tagen. Die Kreisgröße zeigt die Magnitude, die Farbe die Tiefe. Mit dem Schieberegler kannst du die Mindestmagnitude ändern; das Balkendiagramm zeigt die Anzahl aller Beben pro Tag. Zeitpunkt und Diagramm nutzen die lokale Zeit des Geräts.

Die Daten kommen direkt aus dem [USGS-GeoJSON-Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson) (gemeinfrei). Die Seite benötigt eine Internetverbindung, um die Daten, Kartenkacheln und Bibliotheken zu laden.

Auf der [gemeinsamen Karte](karte.html) kannst du Erdbeben, Klima-Orte, Städte, einen Vulnerabilitätsindex, Schummerung, Höhenlinien und Plattengrenzen als Ebenen ein- und ausblenden. Für Höhenlinien gibt es eine Auswahl zwischen allen und beschrifteten Linien. Beide Filter verwenden zwei Schieberegler: Städte filterst du nach Einwohnerzahl auf logarithmischer Skala, Klima-Orte nach Jahresmitteltemperatur, Jahresniederschlag oder Temperaturamplitude. Die Marker-Farben zeigen den gewählten Klimawert; ein Zurücksetzen stellt den Standardbereich wieder her. Die Zähler zeigen sichtbare und gesamte Treffer. Die Filter reagieren auf Maus und Touch. Die Einwohnerwerte sind Näherungswerte, teils einschließlich Ballungsraum. Ein Link im Stadt-Popup öffnet das Walter-Lieth-Diagramm.

Die Städtedaten werden aus Natural Earths gemeinfreien „Populated Places“ erzeugt. Zum Aktualisieren von `data/staedte.json` genügt `node scripts/build_staedte.mjs`; optional kannst du den Pfad zu einer lokalen `ne_10m_populated_places.geojson` als Argument übergeben.

## Kartenauswahl

Auf den Karten kannst du oben rechts zwischen OpenStreetMap, OpenTopoMap, Esri World Imagery und CartoDB Positron wechseln. Die Quellenangaben stehen jeweils direkt auf der Karte. Die zuletzt gewählte Hintergrundkarte und auf der gemeinsamen Karte aktive Themenebenen werden im Browser gespeichert, sofern dieser das zulässt.

## Klimakarte und Walter-Lieth-Diagramm

Im [Klimamodul](module/klima.html) kannst du Klima-Orte nach Jahresmitteltemperatur, Jahresniederschlag oder Temperaturamplitude einfärben und mit dem Wertebereich filtern. Klicke einen Marker an, suche einen Ort oder wähle einen Punkt auf der Karte; der Messpunkt lässt sich auch verschieben. Das Walter-Lieth-Diagramm zeigt die Monatsmitteltemperatur und die mittleren Monatssummen des Niederschlags von 2015 bis 2024. Bis 100 mm gilt das Verhältnis 10 °C zu 20 mm; darüber wird der Niederschlag im Verhältnis 1:10 gestaucht. Angezeigt werden außerdem nächstgelegener Stadtname, Koordinaten und Höhe.

Die Ortsliste steht in `data/orte.json`. Sie wird mit `node scripts/build_orte.mjs` aus den Natural-Earth-Städten schrittweise auf bis zu 2.000 Klima-Orte erweitert: Bestehende Orte bleiben erhalten, und die größten Städte je 5°-Rasterzelle werden bevorzugt. Die Ortsliste umfasst 2.000 Orte; Klimadaten liegen derzeit für 152 davon vor und werden in Läufen von höchstens 90 neuen Orten ergänzt. `node scripts/build_klimadaten.mjs` lädt dafür Tageswerte aus der [Open-Meteo Archive API](https://open-meteo.com/) für 2015 bis 2024, berechnet Jahresmitteltemperatur, Jahresniederschlag und Temperaturamplitude und speichert jeden erfolgreichen Abruf. Datenstand: Klimaperiode 2015–2024; die aktuelle Zahl abgerufener Orte steht in `data/klimadaten.json`. Das Skript benötigt Node.js 20 und keine zusätzlichen Pakete. Bei einem Fehler oder Rate-Limit bleiben alle vorherigen und im Lauf erfolgreich abgerufenen Orte erhalten. Es sind ERA5-Modelldaten, keine Stationsmessungen. Die Daten stehen unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Die GitHub Action „Klimadaten aktualisieren“ läuft während der Erweiterung zweimal täglich, danach werden die zusätzlichen täglichen Läufe übersprungen und nur der monatliche Lauf ausgeführt. Sie lässt sich auch manuell über `workflow_dispatch` starten. Ortssuche und Kartendaten verwenden [OpenStreetMap](https://www.openstreetmap.org/copyright); Erdbebendaten stammen vom [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson) (gemeinfrei). Die Hintergrundkarten haben ihre Quellenangaben direkt auf der Karte. Eine Internetverbindung ist zum Laden der Daten und Karten erforderlich.
