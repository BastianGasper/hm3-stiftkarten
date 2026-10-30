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

## iPad-Querformat, Finger-Scrollstreifen und beweglicher Radierer (V13)

- **Querformat ab 850 CSS-Pixeln:** rechte Lösungsfläche ungefähr **75 %**, linke Frage ungefähr **25 %** der horizontalen Arbeitsfläche.
- **Linker Rand:** durchgehender, ca. 38 px schmaler Scrollstreifen. Mit dem Finger dort hoch- und runterziehen, während das Blatt selbst gegen Handballen und Fingerbewegungen gesperrt ist. Alle normalen Buttons bleiben bedienbar.
- **Kontinuierliches Radieren:** Ein Pencil-Zug des Radierwerkzeugs zeigt während des Kontakts eine **orange Spur und einen Radierer-Cursor**. Alle tatsächlich berührten, separat gezeichneten Pencil-Striche werden vollständig gelöscht. Mehrere Striche können in einem einzigen Radierzug entfernt werden. Die Spur wird nicht als Notiz gespeichert.
- **Rückgängig** stellt in einer Radierbewegung entfernte Striche zusammen wieder her; einzelne Pencil-Züge bleiben getrennte Objekte.

## Ganzstrich-Radierer und Apple-Pencil-Doppeltipp (V12)

- **Radierer · Strich:** Ein einziger Pencil-Zug vom Aufsetzen bis zum Abheben bildet ein eigenes löschbares Element. Das gilt auch für Striche, die sich räumlich schneiden, berühren oder überlappen.
- Beim Radieren wird der dem Berührungspunkt nächstgelegene **einzelne Strich** vollständig gelöscht. Bei exakter Überlappung hat der zuletzt gezeichnete Strich Vorrang. Ab V13 können mehrere berührte Striche in einer Bewegung entfernt werden; ein erneutes Aufsetzen ist nicht erforderlich. **Rückgängig** stellt den gelöschten Strich wieder her.
- Der **Hardware-Doppeltipp auf den Apple Pencil** wird in Safari/iPadOS-Web-Apps nicht als unterstütztes JavaScript-Ereignis bereitgestellt. Apples offizielle Erkennung läuft über native SwiftUI-/UIKit-Schnittstellen (`onPencilDoubleTap`/`UIPencilInteraction`). Deshalb kann diese PWA den Hardware-Doppeltipp nicht zuverlässig zum Werkzeugwechsel verwenden.
- Die Schaltfläche **Radierer · Strich** ist die zuverlässige Alternative. Die Stifteingabe funktioniert dabei wie gehabt Pencil-only.

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
## Abschlussrevision V14 – Zuverlässigkeit und Datensicherheit

- **Aufnahmen:** Bereits archivierte Stiftstriche werden nicht mehr bei weiteren Bewertungen oder Kartenwechseln erneut in den Kontrollverlauf übernommen. Neuzugänge bleiben einzeln nachvollziehbar. Aufnahmen können in der Verwaltung gezielt gelöscht werden; die gewöhnlichen Notizblätter bleiben dabei erhalten.
- **Datensicherung:** Ein Gesamtbackup wird nur dann als erfolgreich gemeldet, wenn die zugehörigen IDB-Daten tatsächlich gelesen werden konnten. Beschädigte oder unvollständige Imports werden vor dem Überschreiben der bisherigen Daten zurückgewiesen. Die lokale Ersatzspeicherung stellt nach einem Import keine alten Kontrollarchive wieder her.
- **iPad-Speicher:** Nur das eigentliche Lösungsblatt nutzt hochaufgelöste Canvas-Pixel; die kurzlebige orange Radier-Vorschau zeichnet mit einer sparsamen Auflösung. Der Radierer verwendet zwischengespeicherte Strichbegrenzungen und robuste Segmentabstände.
- **ZIP-Export:** PNGs werden bis zur tatsächlich beschriebenen Höhe berechnet; auch bei 4000 px verlängerten Blättern wird eine Rechnung nicht an einer festen Bildhöhe abgeschnitten. Die Auflösung wird bei langen Seiten reduziert, statt unverhältnismäßig große Bilddateien zu erzeugen.
- **Bedienung:** Das Scrollen über den linken Fingerstreifen pausiert während eines laufenden Pencil-Kontakts, um Koordinatensprünge auszuschließen. Während des Schreibens lässt sich weder die App neu laden noch eine Aufnahme stoppen. Das feststehende Bedienfeld ist jetzt kompakter und bleibt links.
- Die Anzeige in der Fußzeile nennt die aktuelle App-Version. Keine CSS-Animationen, keine automatische Handschrifterkennung, keine Cloud-Übertragung deiner Skizzen.
- **Grenze der Tests:** Die Kernlogik wurde mit automatisierten Browser-/Ereignis-Mocks geprüft; tatsächliche iPadOS-Pencil-Hardware, Safari-Cache-Lebensdauer und GitHub-Pages-Auslieferung benötigen eine Prüfung auf dem Gerät.

## UI-Bereinigung V15

- Die App heißt in Titelleiste und Web-App-Manifest **HM3 Theorie Basti**. Das bestehende Repository, die PWA-Start-URL und die internen Backupkennungen bleiben aus Kompatibilitätsgründen unverändert.
- Der linke Finger-Scrollstreifen hat keinen sichtbaren Text und bekommt im Seitenlayout eine reservierte Randspalte. Alle Modus-, Pfeil- und Blatt-Buttons sind in die normale obere Bedienzeile verlegt, statt über Karteikarten oder Schreibblatt zu schweben.
- Der lange orange Erklärungstext des Radierers, die Hinweise unter Karte und Lösungsblatt sowie die Leerzustands-Texte zur Aufnahme sind entfernt. Bei aktiver Aufnahme erscheint weiterhin eine kompakte Statusanzeige.
- Die normale Bestätigung „Auf diesem Gerät gespeichert“ ist ausgeblendet. **Echte Speicherfehler bleiben ausdrücklich sichtbar.**
- Wer die Web-App schon auf dem iPad installiert hat, kann für die sichtbare Umbenennung des Home-Bildschirm-Icons gegebenenfalls neu hinzufügen müssen. Vor einem Entfernen der alten Installation unbedingt ein Gesamtbackup anlegen.

## V16 – Vorlesungsnahe Karteikarten und frei konfigurierbare Abfragen

- **63 vollständig neu formulierte Fragen** zu den Vorlesungsnotizen **V01–V06**, davon 12 Beweiskarten. Überblick: V01 7, V02 10, V03 8, V04 8, V05 9, V06 9, Beweise 12. Alle Fragen verlangen ausdrücklich den gefragten Zusammenhang, Ansatz, Bedingungen und ggf. genaue Rechenschritte. Eine kleine Zahl mathematisch präziser Karten ersetzt die bisherige Sammlung von 95 kurzen Definitionsfragen. Alte Karteikarten werden in `archive/cards-v15.json` separat als Archiv aufbewahrt.
- **Abfrage starten** → Auswahl beliebiger Kombinationen von Vorlesungsbereichen und Fragetypen per Checkbox → eine zufällig sortierte Runde mit genau allen ausgewählten Karten.
- Nach jeder Runde: **Richtig / Teilweise / Falsch** bezogen auf sämtliche ursprünglichen Karten. **Falsche wiederholen**, **Teilweise wiederholen** oder **Alle wiederholen** starten eine neue zufällige Runde mit dem jeweiligen Teilpool. Die Bewertung jeder erneut bearbeiteten Karte überschreibt ihren letzten Status im ursprünglichen Pool; alle anderen bleiben unverändert. Wiederholungen sind unbegrenzt möglich, **Abfrage beenden** beendet die gesamte Sitzung.
- Gestartete Abfragen werden in `localStorage` gespeichert und nach App-Neustart fortgesetzt. Ein neuer Kartensatz kann alte aktive Abfragen ungültig machen; in diesem Fall kehrt die App zum normalen Lernmodus zurück.
- Die Abfrage zeigt keine Erklärungstexte beim Start, während der Bearbeitung oder in der Ergebnistafel. Handgeschriebene Lösungsskizzen und der optionale Aufnahmemodus bleiben separat nutzbar.
- **Wichtig für bestehende iPad-Daten:** Neue Karten verwenden bewusst **neue IDs**, sodass alte handschriftliche Notizen nicht fälschlich einer inhaltlich veränderten Karte zugeordnet werden. Die alten Stiftzeichnungen bleiben in IndexedDB und sind im JSON-Gesamtbackup enthalten. Sie erscheinen nicht mehr automatisch auf den neuen Karten. Bestehende Aufnahmen mit ihren damaligen Fragen und Bildern bleiben lesbar. Vor und nach dem Update ein Gesamtbackup exportieren.
- Die neu verfassten Karten basieren auf den handschriftlichen Mitschriften V01–V06; Übungsblattfragen außerhalb dieses Materials wurden nicht als zusätzliche Vorlesungsinhalte behauptet.

## V17 – Beweislernmodus und testatgerechte Aufgaben

- Neuer eigener Button **Beweise lernen**: 29 konkrete Nachweise aus V01–V06, Ü00–Ü03 und kenntlich gemachte mathematische Ergänzungen. Für jeden Beweis fünf getrennte Lernschritte: **Problem → Behauptung → Voraussetzungen → Ansatz → Durchführung**. Jeder Schritt enthält eine mathematisch bestimmte Aufgabe und eine erst auf Knopfdruck sichtbare, ausgearbeitete Antwort.
- Vor-/Zurück-Tasten, Beweiswahl und **Beenden**. Jeder Schritt hat sein eigenes dauerhaft lokal gespeichertes kariertes Pencil-Notizblatt. Ein begonnenes Beweislernen kann nach Neustart fortgesetzt werden. Bei einer neuen Auswahl wird der Schrittzähler zurückgesetzt, bereits gespeicherte Notizen bleiben pro Beweis und Schritt erhalten.
- Die Quelleneinordnung ist sichtbar: Vorlesungsbeweis, Vorlesungsskizze, Übungsnachweis oder ergänzender Vollbeweis. Gerade Peano und Picard-Lindelöf unterscheiden zwischen skizziertem Satz und zusätzlich streng ausgearbeitetem Beweis.
- Neuer Kartensatz: **41 komplexere mehrteilige Aufgaben**, davon **13 Testat-Aufgaben**, statt V16 mit 63 teilweise zu kleinen Karten. Die neuen IDs verhindern eine falsche Zuordnung alter Zeichnungen. V16 bleibt als `archive/cards-v16.json` erhalten. Die Testat-Kategorie kann im gewöhnlichen Kartenfilter und in individuell ausgewählten Quiz-Runden ausgewählt werden. Antworten sind ausdrücklich keine Ein-Satz-Schlagwörter, sondern Voraussetzungen, Herleitung, Rechnung und Probe.
- `proofs.json` ist Teil des vollständigen Offline-Pakets und des PWA-Update-Caches. Die App nutzt weiter ausschließlich lokal gespeicherte Daten, bis ausdrücklich ein Export erfolgt.
- Die bestehende Aufnahmefunktion bleibt erhalten. Das eigene Beweislernen beginnt aus Sicherheitsgründen nicht während einer laufenden Aufnahme oder einer laufenden Abfrage.

### V17.1 – Formelsatz korrigiert

- LaTeX-Ungleichungen (insbesondere `\\ne0`) bleiben unversehrt. Eine falsch formatierte Zustandsraum-Matrix wurde korrigiert.
- Der gesamte neue Fragen-/Beweiskatalog wurde zusätzlich mit MathJax auf 1.142 mathematische Ausdrücke geprüft (keine Formelsatz-Fehler).

## V18: Unsichtbare Scrollzone, Beweisvorbereitung und vertiefte Lernkarten

- Auf dem iPad beginnt **Finger-Scrollen im linken 20-%-Bereich der Bildschirmbreite**, in Auto, Schreiben und Scrollen. Kein sichtbarer Randstreifen oder Overlay. Startet die Geste außerhalb dieses Bereichs, bleibt die Seite gesperrt. Ein Tap auf dort liegende Buttons bleibt ein Tap; erst die Bewegung löst das Scrollen aus. Während eines laufenden Pencil-Strichs wird nicht gescrollt. Dialoge behalten ihre eigene Navigation. Die bisherigen ↑/↓-Buttons funktionieren weiterhin.
- **Beweise lernen:** Vor den fünf eigentlichen Stufen erscheinen jetzt zwei eigenständige vorbereitende Informationsseiten je Beweis: **Einordnung** und **Mathematischer Werkzeugkasten**. Inhaltlich sind sie aus vorhandenen V01–V06/Übungsnachweisen und den mathematisch kenntlich gemachten Ergänzungen abgeleitet. Erst nach „Beweis beginnen“ kommt **Problem → Behauptung → Voraussetzungen → Ansatz → Durchführung** mit eigener Schreibfläche je Schritt. Zurück funktioniert bis zu den Infoseiten; Position und Zustand bleiben lokal gespeichert.
- **25 statt 41 Karten** (17 in V01–V06 + 8 Testat). Jede Karte umfasst eine mehrteilige Kernaufgabe und eine zusätzliche prüfungsartige Anforderung. Die Musterlösungen enthalten einen ausführlicheren Begründungs-/Herleitungsteil. **Hintergrund** und **Beispiel / Transfer** sind erst nach Aufdecken der Antwort separat ausklappbar. Neue Inhalte benutzen keine rein deklarativen Stichwortantworten.
- **Datenmigration:** Beibehaltene Karten behalten ihre IDs, Stiftblätter und Favoriten. Alte, herausgenommene Karten liegen archiviert unter `archive/cards-v17.json`; ihre früheren Notizen verbleiben im iPad-Speicher. Die Beweisnotiz-IDs bleiben unverändert. Auch im lokalen Ersatzspeicher werden beim Gesamtbackup sämtliche Notizschlüssel (einschließlich Beweisen und archivierter Karten) berücksichtigt.
- **Offline**: `cards.json` und `proofs.json` bleiben Bestandteil des Service-Worker-Pakets. Es werden keine persönlichen Notizen auf GitHub hochgeladen. Vor größeren Updates bitte ein JSON-Gesamtbackup erstellen.

Hinweis: Vorlesungsnachweise sind von mathematisch ergänzten Vollbeweisen unterscheidbar. Die Fragen bauen auf den bislang verfügbaren Mitschriften und zugeordneten Übungsnachweisen auf; neue Unterlagen können später gezielt ergänzt werden.

## V19: Kartenmarkierungen, neue Schreibblätter und opt-in GitHub-Aufnahmen-Sync

- **Markieren** an einer Frage ist getrennt vom bisherigen **Favoriten-Stern**. Im Menü **Karten verwalten → Status → Markierte Fragen** sind diese jederzeit separat abrufbar, bearbeitbar und wieder entmarkierbar; Markierungen bleiben auf diesem Gerät und sind Teil des JSON-Gesamtbackups.
- Jede neu angezeigte Karte erhält eine **neue, leere Schreibfläche**. Die **aktuell offene** Karte behält ihre Skizze bei einem Neustart der App, damit ein unterbrochener Versuch nicht verloren geht. Bei der nächsten Begegnung entsteht wieder ein frisches Blatt. Die bereits gespeicherten Kontrollversuche in einer Aufnahme werden nicht überschrieben, sondern unabhängig archiviert. Die vorhandenen Beweis-Notizblätter je Stufe bleiben weiterhin wiederverwendbar.
- ↑ Hoch, ↓ Runter und + Blatt sowie die Netzwerkstatusanzeige wurden aus der Oberfläche entfernt. Die bisherige **unsichtbare 20-%-Finger-Scrollzone** bleibt; Blattlänge kann weiterhin unten am Blatt über **Blattlänge** eingestellt werden.
- **GitHub-Aufnahmen-Synchronisierung ist optional und zunächst AUS**: In **Einstellungen → GitHub-Aufnahmen** ein eigenes, idealerweise **privates** GitHub-Repository (z. B. `BastianGasper/hm3-theorie-aufnahmen`) und einen **Fine-grained personal access token** mit **Contents: Read and write**, nur für dieses eine Repository, eingeben. Erst nach erfolgreicher Prüfung durch die GitHub-API wird die Konfiguration lokal auf diesem iPad gespeichert. Der Token befindet sich ausschließlich im separaten LocalStorage-Schlüssel `hm3-github-sync-v1` und wird weder ins Repository noch in die Aufnahmen-ZIPs oder das Gesamtbackup geschrieben. **Ein Token in browserseitigem Speicher birgt Sicherheitsrisiken; nur einen minimal berechtigten Token verwenden.** Nach Deaktivierung oder „Verbindung entfernen“ wird der Token gelöscht.
- Der GitHub-Abgleich übernimmt neue **abgeschlossene und benannte** Aufnahmen automatisch. Bei fehlendem Netz verbleibt ein persistenter **ausstehend**-Vermerk in der lokalen Session; ein erneuter Versuch erfolgt bei Rückkehr der Verbindung, beim Öffnen der App oder beim Aktivwerden im Vordergrund. Frühere Aufnahmen werden nur mit **„Jetzt synchronisieren“** und Rückfrage vorgemerkt. Für jedes Archiv wird in dem Zielrepo eine ZIP unter `aufnahmen/JJJJ-MM-TT/<session-id>.zip` angelegt, mit `LERNDURCHGANG.html`, `lerndurchgang.json` inklusive Vektordaten und den PNG-Skizzen. Erfolgreiche Uploads sind unter **Aufnahmen** verlinkt. Der Upload überschreibt keine vorhandene GitHub-Datei. Das Zielrepo wird vor jedem Sync geprüft: **Öffentliche Repos sind standardmäßig gesperrt** und benötigen eine separate explizite Zustimmung.
- **Wichtige iPadOS-Grenze:** Safari unterstützt keinen Background Sync. Eine vollständig geschlossene PWA kann daher nicht zuverlässig selbständig sofort beim Wiederkehren der Internetverbindung hochladen. Der Upload wird automatisch beim nächsten Öffnen bzw. laufender App fortgesetzt. Die Daten bleiben lokal bis zum bestätigten Upload.
