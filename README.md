# HM3 Stiftkarten

Kostenlose, schlichte, offlinefähige iPad-Web-App für Höhere Mathematik III (TU Dortmund). **Keine Animationen, keine Handschrifterkennung, keine automatische Bewertung.** Handgezeichnete Lösungen werden je Karte gespeichert und bei jeder Bewertung als separater Versuch archiviert.

## Start

- Website: https://bastiangasper.github.io/hm3-stiftkarten/
- Auf dem iPad in Safari öffnen und über **Teilen → Zum Home-Bildschirm** installieren.
- Bei Apple-Pencil-Nutzung in *Einstellungen* **Nur mit Apple Pencil zeichnen** aktiv lassen. Finger können dann über die Schreibfläche scrollen. Falls das Schreiben auf einem konkreten iPad Probleme macht, diese Option testweise ausschalten.

## Lernablauf und Auswertung

1. Frage öffnen, mit Apple Pencil auf das Lösungsblatt schreiben (ohne Texterkennung).
2. Musterantwort aufdecken und **Nicht gewusst / Teilweise / Gewusst** wählen.
3. Jede Bewertung speichert den *damaligen* handschriftlichen Stand als separaten **Versuch** im **Durchgang**. Späteres Überschreiben des Notizblatts entfernt keine bereits archivierten Versuche.
4. **Durchgang exportieren** lädt eine ZIP-Datei herunter. Enthalten sind:
   - `LERNDURCHGANG.html`: geordneter Bericht mit Fragen, Selbsteinschätzung, Skizzen, Musterantworten;
   - `lerndurchgang.json`: strukturierte Daten inkl. Stiftstrichen und Karteikartentexten;
   - `skizzen/*.png`: pro Versuch eine sichtbare PNG der Handschrift.
5. **ZIP hier im Chat hochladen** und um Prüfung bitten. Erst dadurch gelangen Daten an ChatGPT; die App selbst führt keinen Upload durch.

Unter *Einstellungen → Gesamtes Backup (JSON)* lassen sich außerdem alle Durchgänge, aktuellen Notizen und Bewertungen sichern bzw. wiederherstellen. **Vor dem Löschen von Safari-Websitedaten unbedingt ein Backup exportieren.** Daten liegen lokal im Safari-Profil dieses Geräts, ohne Cloud-Synchronisierung.

## Neue Karteikarten hinzufügen (ohne Programmcode zu ändern)

Nur die Datei [`cards.json`](cards.json) erweitern. Beispiel:

```json
{
  "id": "hm3-096",
  "Bereich": "V06",
  "Typ": "Beweisidee",
  "Frage": "Unter welchen Voraussetzungen funktioniert die Variation der Konstanten?",
  "Antwort": "Bei einer linearen DGL und bekanntem Fundamentalsystem ...",
  "Quelle": "V05 S. 2-3"
}
```

Die äußere Datei enthält ein Array dieser Kartenobjekte. **ID dauerhaft eindeutig und stabil halten**: Nachträgliches Ändern einer ID trennt alte Notizen und Bewertungen von der Karte. Bestehende Karten nicht umsortieren oder löschen, wenn sie noch verwendet werden. LaTeX in `Frage`/`Antwort` in `\\(...\\)` schreiben und korrekt für JSON escapen. Beim nächsten Onlineaufruf lädt die App die aktualisierte `cards.json` neu (offline wird die zuletzt gespeicherte Version angezeigt). Die lokale Lerndatenbank bleibt erhalten.

Die App hat keinen serverseitigen Schreibzugriff, sodass lokal hinzugefügte Fragen nicht automatisch auf GitHub landen. Für regelmäßige Erweiterungen können die Karten über den GitHub-Connector direkt ergänzt werden.

## Technische Architektur

- `index.html` – semantische Oberfläche, unveränderliche Steuerelement-IDs
- `style.css` – responsives schlichtes Layout ohne Transitionen/Animationen
- `app.js` – Kartenauswahl, Canvas, Versuchsspeicher, Exporte
- `cards.json` – eigenständig pflegbarer Kartensatz (95 Startkarten)
- `assets/mathjax-tex-svg.js` – lokale Formelsetzung, keine externen CDN-Abhängigkeiten
- `sw.js` – Offline-Cache, Online-first für `cards.json`
- `manifest.webmanifest`, `assets/icon-*.png` – Homescreen-Unterstützung

Lokale Daten: `IndexedDB`-Datenbank `hm3-stiftkarten-notes` (Version 2) mit Stores `sketches`, `attempts`, `sessions`. Lernstatus und Einstellungen liegen in `localStorage` (`hm3-stiftkarten-v2`). Bestehende Zeichenblätter aus Version 1 werden weitergelesen und nicht gelöscht. JSON-Backup der Version 1 kann ebenfalls importiert werden. Bei fehlendem IndexedDB wird auf eine eingeschränkte localStorage-Sicherung zurückgegriffen; in diesem Fall unbedingt frühzeitig ein Backup erstellen.

Keine Telemetrie, keine Konten. ZIP wird im Browser erstellt; kein Netztransfer der Notizen.