# HM3 Stiftkarten

Kostenlose, schlichte, offlinefähige iPad-Web-App für Höhere Mathematik III (TU Dortmund). **Keine Animationen, keine Handschrifterkennung, keine automatische Bewertung.** Handgezeichnete Lösungen werden je Karte gespeichert und bei jeder Bewertung als separater Versuch archiviert.

## Start

- Website: https://bastiangasper.github.io/hm3-stiftkarten/
- Auf dem iPad in Safari öffnen und über **Teilen → Zum Home-Bildschirm** installieren.
- **Auto (Standard, V11):** Die Seite bleibt dauerhaft gesperrt, ohne durch `position: fixed` verschoben zu werden. **Apple Pencil zeichnet; Finger und Handfläche auf dem Blatt werden ignoriert.** Alle normalen Buttons bleiben antippbar. Ein kleines Steuerfeld **unten links** bietet `↑ Hoch`, `↓ Runter` und `+ Blatt`. Auf der rechten und unteren rechten Seite stehen keine schwebenden Bedienelemente. **Scrollen** als manuelle Alternative gibt Finger-Scrollen frei und pausiert das Zeichnen. **Schreiben** bleibt als harter Pencil-only-Fallback.

## Freiwillige Aufnahmen für die mathematische Kontrolle (V10)

- **● Aufnahme starten:** Nur ab diesem Zeitpunkt werden neue Lösungsversuche als Kontrollmaterial archiviert. Im freien Lernmodus werden aktuelle Notizblätter und Fortschritt lokal gespeichert, aber keine neuen auswertbaren Versuchsarchive angelegt.
- Während einer Aufnahme werden Selbstbewertungen als Versuche gespeichert. Neu mit dem Pencil gezeichnete Striche sind mit der laufenden Aufnahme markiert und gelangen beim Bewertungs- oder Kartenwechsel in deren Archiv. Ein nicht bewertetes Lösungsblatt wird als Entwurf gesichert.
- **■ Stopp:** Aufnahme beenden, anschließend benennen. **Speichern** lässt sie lokal auf dem iPad, **Speichern und ZIP exportieren** erstellt zusätzlich den Bericht mit handschriftlichen PNGs für ChatGPT.
- **Aufnahmen:** Liste der bisherigen Aufnahmen und Download jeder Aufnahme. Frühere, bereits unter V1–V9 aufgezeichnete Durchgänge bleiben aus Kompatibilitätsgründen erhalten.
- Es erfolgt **kein GitHub-Upload**: Das aktuelle Repository ist öffentlich, während handschriftliche Lerndaten privat bleiben sollen. GitHub wird nur für den Programmcode und den allgemeinen Kartensatz verwendet.
- Gesamtbackup (JSON) umfasst weiterhin sämtliche lokalen Daten. Aufnahmen benötigen keinen Internetzugang.

## Lernablauf und Auswertung

1. Frage öffnen, mit Apple Pencil auf das Lösungsblatt schreiben (ohne Texterkennung).
2. Für eine spätere Kontrolle zunächst **Aufnahme starten**. Danach Musterantwort aufdecken und **Nicht gewusst / Teilweise / Gewusst** wählen. Ohne Aufnahme wird nur der Lernfortschritt gespeichert, kein auswertbarer Versuch.
3. Während einer Aufnahme speichert jede Bewertung den *damaligen* handschriftlichen Stand als separaten **Versuch**. Späteres Überschreiben des Notizblatts entfernt keine bereits archivierten Versuche.
4. **Durchgang exportieren** lädt eine ZIP-Datei herunter. Enthalten sind:
   - `LERNDURCHGANG.html`: geordneter Bericht mit Fragen, Selbsteinschätzung, Skizzen, Musterantworten;
   - `lerndurchgang.json`: strukturierte Daten inkl. Stiftstrichen und Karteikartentexten;
   - `skizzen/*.png`: pro Versuch eine sichtbare PNG der Handschrift.
5. **ZIP hier im Chat hochladen** und um Prüfung bitten. Erst dadurch gelangen Daten an ChatGPT; die App selbst führt keinen Upload durch.

Unter *Einstellungen → Gesamtes Backup (JSON)* lassen sich außerdem alle Durchgänge, aktuellen Notizen und Bewertungen sichern bzw. wiederherstellen. **Vor dem Löschen von Safari-Websitedaten unbedingt ein Backup exportieren.** Daten liegen lokal im Safari-Profil dieses Geräts, ohne Cloud-Synchronisierung.

## Karten verwalten und selbst bearbeiten

- Direkt an einer Karte: **☆ / ★** speichert einen Favoriten; **Deaktivieren / Aktivieren** blendet eine Karte aus normalen Lerndurchgängen aus, ohne Notizen oder Bewertungen zu löschen. **Bearbeiten** öffnet den Texteditor für Frage und Musterlösung.
- **Karten verwalten** in der Kopfzeile zeigt alle Karten, durchsucht Frage, Lösung, Thema und Quelle, klappt Musterlösungen direkt in der Liste auf und filtert nach aktiv, deaktiviert und Favorit. Über **Öffnen** kann man auch eine deaktivierte Karte einzeln ansehen.
- **Favoriten** als Lernmodus zeigt nur aktive markierte Karten.
- Bearbeitete Texte, Favoriten und Deaktivierungen werden **lokal auf dem verwendeten Gerät** gespeichert. Sie überleben Aktualisierungen der App und von `cards.json`, solange die stabilen Karten-IDs unverändert bleiben. Historische Versuche behalten die zum Zeitpunkt des Versuchs gespeicherten Texte.
- **Original wiederherstellen** setzt nur Frage und Musterlösung dieser Karte zurück; vorhandene Handschriften und Lernfortschritte bleiben erhalten.
- **Gesamtes Backup (JSON)** enthält auch diese persönlichen Änderungen. Wiederherstellen funktioniert mit alten V1/V2-Backups und neuen V2-Backups mit `cardPrefs`.
- Wichtiger Unterschied: Änderungen im Karteneditor **ändern nicht** die GitHub-Datei `cards.json` und synchronisieren nicht zwischen Geräten. Für allgemeine Kartenaktualisierungen muss weiterhin die JSON-Datei im Repository bearbeitet werden. Deine lokalen Textänderungen haben auf diesem Gerät Vorrang vor der GitHub-Version, bis du sie zurücksetzt.

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

## Feinere Handschrift und Offline-Paket (V8)

- Die Stiftlinien werden als geglättete quadratische Kurven gerendert. Normale Blätter nutzen bis zu **3x Pixeldichte pro CSS-Achse**, lange Blätter erhalten ein adaptives Limit von insgesamt höchstens ca. 16 Mio. Canvas-Pixeln.
- Die handschriftlichen Skizzen bleiben als Strichdaten in IndexedDB gespeichert; nach dem nächsten Öffnen werden sie mit der neuen Glättung erneut gezeichnet. Exportbilder werden mit 1600 px Breite erzeugt.
- **Einstellungen → Alle Offline-Dateien sichern:** lädt Oberfläche, Programmcode, Formeldarstellung, Karten und Icons in den Cache. Bei erfolgreicher Meldung mit ausgeschaltetem WLAN auf dem installierten iPad testen.
- **Online-/Offline-Anzeige** in der Kopfzeile. Beim Wiederverbinden oder Öffnen werden Updates anhand von `version.json` geprüft und der neue Service Worker lädt Ressourcen im Hintergrund. Bei Änderungen erscheint **Neue Version laden**. Kein erzwungener Reload mitten im Schreiben.
- Für neue Releases gemeinsam die Versionskennung in `app.js` (`APP_VERSION`) und `version.json` erhöhen sowie den Cache-Namen in `sw.js` ändern, damit Offline-Nutzer die Änderung sicher erkennen und herunterladen können.
- **Wichtig:** Offline-Karten und lokale Bewertungen/Skizzen synchronisieren sich **nicht in die Cloud**. Für Gerätewechsel und Schutz vor iPadOS-Speicherbereinigung regelmäßig das **Gesamtbackup (JSON)** exportieren.

## Technische Architektur

- `index.html` – semantische Oberfläche, unveränderliche Steuerelement-IDs
- `style.css` – responsives schlichtes Layout ohne Transitionen/Animationen
- `app.js` – Kartenauswahl, Canvas, Versuchsspeicher, Exporte
- `cards.json` – eigenständig pflegbarer Kartensatz (95 Startkarten)
- `assets/mathjax-tex-svg.js` – lokale Formelsetzung, keine externen CDN-Abhängigkeiten
- `sw.js` – Offline-Cache für alle App-Dateien, Online-first für aktualisierbare Inhalte
- `version.json` – Versionssignal für Prüfung nach Wiederverbindung
- `manifest.webmanifest`, `assets/icon-*.png` – Homescreen-Unterstützung

Lokale Daten: `IndexedDB`-Datenbank `hm3-stiftkarten-notes` (Version 2) mit Stores `sketches`, `attempts`, `sessions`. Lernstatus und Einstellungen liegen in `localStorage` (`hm3-stiftkarten-v2`). Bestehende Zeichenblätter aus Version 1 werden weitergelesen und nicht gelöscht. JSON-Backup der Version 1 kann ebenfalls importiert werden. Bei fehlendem IndexedDB wird auf eine eingeschränkte localStorage-Sicherung zurückgegriffen; in diesem Fall unbedingt frühzeitig ein Backup erstellen.

Keine Telemetrie, keine Konten. ZIP wird im Browser erstellt; kein Netztransfer der Notizen.