# HM3 Stiftkarten

Kleine, kostenlose iPad-Web-App zum Lernen von **Höhere Mathematik III** mit dem Apple Pencil. Enthält 95 Karteikarten zu V01–V06 und Ü00–Ü03.

Die App erkennt **keine Handschrift**. Du skizzierst deine Lösung frei auf dem Notizblatt, zeigst anschließend die Musterantwort an und bewertest selbst, wie gut du die Aufgabe konntest.

## Funktionen

- 95 Karten mit Formeln, Beweisideen und Theoriefragen
- Freies Schreiben mit Apple Pencil oder Finger, Stiftfarben, Radierer, Undo/Redo
- Papier wahlweise kariert, liniert oder blanko und in mehreren Höhen
- Ein Notizblatt pro Karte, automatisch lokal gespeichert
- Selbstbewertung: Nicht gewusst / Teilweise / Gewusst
- Wiederholung je nach Bewertung
- JSON-Backup und -Wiederherstellung
- Offline-Nutzung nach erstmaligem Laden der Webseite, wenn der Service Worker erfolgreich installiert wurde

## Nutzung auf dem iPad

1. Nach Aktivierung von GitHub Pages die veröffentlichte Webadresse in **Safari** öffnen.
2. Über **Teilen → Zum Home-Bildschirm** hinzufügen.
3. Die App vom Home-Bildschirm starten und loslernen.

Die Notizen und Lernbewertungen bleiben **lokal auf dem jeweiligen Gerät**. Sie werden nicht zu GitHub oder einem Server übertragen und nicht zwischen Geräten synchronisiert. Bei Browserdatenlöschung oder Webadresswechsel sind sie möglicherweise weg – deshalb regelmäßig unter ⚙ ein **JSON-Backup** erstellen.

## Kostenlos mit GitHub Pages veröffentlichen

1. Neues **öffentliches** Repository `hm3-stiftkarten` auf GitHub erstellen.
2. Die Dateien dieses Verzeichnisses ins **Stammverzeichnis** des `main`-Branches hochladen (also `index.html` direkt im Repository-Hauptordner).
3. Unter **Settings → Pages → Build and deployment** die Option **Deploy from a branch** auswählen, dann **main** und **/(root)** und auf **Save** klicken.
4. Die Seite ist anschließend unter `https://BastianGasper.github.io/hm3-stiftkarten/` erreichbar, sofern der Repositoryname unverändert bleibt.

Quellcode und Kartentexte liegen in einem öffentlichen Repository, persönliche Notizen dagegen nur auf deinem Gerät. Die ursprünglichen Vorlesungs-PDFs werden nicht veröffentlicht.

## Technik

Statisches HTML, CSS, JavaScript, MathJax für Matheformeln, IndexedDB für Zeichnungen, LocalStorage für Lernfortschritt, Service Worker fürs Offline-Caching. Kein Backend, keine Anmeldung, kein Tracking.

Die `index.html`, `app.js`, `data.js`, `style.css`, `manifest.webmanifest`, `sw.js` und der Ordner `assets/` müssen zusammen hochgeladen werden.