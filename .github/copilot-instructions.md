# Projekt: Geodaten-Dashboard für den Geographieunterricht

## Ziel
Statische Webseite (GitHub Pages) mit interaktiven Karten und Diagrammen
zu offenen Geodaten, nutzbar von Schülerinnen und Schülern (Gymnasium, BW).

## Technik
- Reines HTML, CSS und JavaScript, kein Build-Schritt, kein Backend
- Karten: Leaflet.js, Diagramme: Chart.js (Versionen fest pinnen, via CDN)
- Jedes Modul ist eine eigene Seite unter /module/<name>.html
- Gemeinsame Styles in /assets/style.css, gemeinsamer Code in /assets/

## Regeln
- Keine API-Schlüssel, Passwörter oder Tokens im Repository
- Nur Datenquellen ohne Schlüssel oder mit klarer offener Lizenz
- Quelle und Lizenz jeder Datenquelle auf der Seite sichtbar angeben
- Deutsche Oberfläche, einfache Sprache, gut lesbar auf dem Handy
- Barrierefrei: Alt-Texte, ausreichende Kontraste, Tastaturbedienung
- Seiten müssen sauber auf DIN A4 druckbar sein (@media print)
- Fehlerfall abfangen: Wenn die Daten nicht laden, verständliche Meldung
- Kleine, nachvollziehbare Commits, Änderungen nur per Pull Request
