# Español ¡ya! – Projektnotizen

Spanisch-Lern-App (PWA) für eine*n deutschsprachige*n Anfänger*in, läuft auf GitHub Pages:
https://spanishk420.github.io/spanish/ – auf dem iPhone über Safari „Zum Home-Bildschirm“ installiert.
Kommunikation mit dem Nutzer auf Deutsch, locker, kurze Antworten.

## Aufbau
- `index.html` wird GEBAUT, nicht direkt bearbeiten: `python3 src/build.py src/base.html`
  - `src/base.html`: Karteikarten-App (Kapitel, Daten, Karteikarten-Logik, Stimmen-Auswahl, Reset)
  - `src/voice.js`: Sprachmodus (Vorlesen per speechSynthesis, Spracherkennung per webkitSpeechRecognition)
  - `src/build.py`: fügt PWA-Head, Sprachmodus-HTML/CSS und voice.js in base.html ein
- `sw.js`: Service Worker (network-first). Bei Änderungen die Cache-Version (`espanol-vN`) hochzählen.
- `manifest.webmanifest`, `icons/`: PWA-Metadaten, Icon „ñ“ mit Sonne.
- `robots.txt` + `<meta name="robots" content="noindex">`: Seite soll nicht in Suchmaschinen auftauchen (bewusst, privat).

## Kapitel
1. Verben (30, beide Richtungen) · 2. Farben simpel (10 Grundfarben) · 3. Weitere Farben · 4. Zahlen (0–100, 200, 500, 1000; eintippen)
5. Konjugation und 6. Alltagssätze sind als „bald“ markiert.
Fortschritt nur in localStorage (`verbos-v2`). Gewichtung: niedriges Level und häufiges „nicht gewusst“ kommen öfter dran.

## Sprachmodus – Wünsche des Nutzers
- Für unterwegs/Auto, ohne Tippen.
- Mikrofon soll durchgehend laufen (kein Siri-Piepton bei jedem Wort) → continuous recognition, Neustart nur beim Sprachwechsel; Karten in 5er-Blöcken pro Richtung.
- Neues Wort wird einmal in seiner Sprache vorgelesen (Deutsch → deutsche Stimme, Spanisch → spanische Stimme, Zahlen deutsch).
- Richtig → nur „Richtig“, sofort weiter. Falsch → „Falsch“ + richtige Lösung.
- Erkennung tolerant (z. B. „abla“/„habla“ = hablar), aber ähnliche falsche Wörter ablehnen (ver ≠ beber, correr ≠ comer).
- Stand 1.11.2026: auf echtem iPhone noch nicht bestätigt. Erster Test meldete „erkennt gar nichts“ und störenden Aufnahme-Ton; daraufhin auf durchgehende Erkennung mit Live-Anzeige „Gehört: …“ umgebaut. Offen: ob Erkennung in der Home-Bildschirm-App funktioniert und ob iOS die Sprachausgabe bei laufendem Mikrofon leiser macht.

## Privatsphäre
- Repo ist öffentlich. Keine persönlichen Daten committen. Commits als `Claude <noreply@anthropic.com>`.
- Kein Impressum, solange die App rein privat genutzt wird (Nutzer + Freundin).
