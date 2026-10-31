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
- Mikrofon: kein Siri-Piepton gewünscht – aber durchgehende Erkennung + gleichzeitige Sprachausgabe hat auf dem iPhone „erkennt nichts“ ergeben. Seit 31.10.2026: Mikro pro Antwort frisch gestartet (nach der Ansage, nie während TTS), Zwischenergebnisse werden sofort ausgewertet. Karten in 5er-Blöcken pro Richtung.
- Neues Wort wird einmal in seiner Sprache vorgelesen (Deutsch → deutsche Stimme, Spanisch → spanische Stimme, Zahlen deutsch).
- Richtig → nur Sound (Pling), sofort weiter. Falsch → tiefer Sound + richtige Lösung. Sounds als WAV im JS erzeugt, über <audio> (spielt auch bei Stummschalter).
- Stimme soll menschlich klingen: Premium-Stimmen werden bevorzugt (voiceTier), Hinweis zum Laden in iOS-Einstellungen. Externe Neural-TTS (edge-tts, Piper-Download) war aus dem Container nicht erreichbar.
- Erkennung tolerant (z. B. „abla“/„habla“ = hablar), aber ähnliche falsche Wörter ablehnen (ver ≠ beber, correr ≠ comer).
- TTS: Nutzer meldete deutsche Stimme für spanische Wörter → Stimme wird jetzt immer explizit gesetzt und frisch aus getVoices() geholt (iOS liefert die Liste verzögert); erstes speak() synchron im Start-Tipp.
- Diagnose im Sprachmodus: Zeile mit gewählten Stimmen / Mikro-Fehlern, Knopf „🧪 Mikro testen“. Nach 2 stillen Runden Hinweis (Home-Bildschirm-App vs. Safari, Siri & Diktieren).
- Offen: Bestätigung auf echtem iPhone, v. a. ob Erkennung in der Home-Bildschirm-App geht.

## Privatsphäre
- Repo ist öffentlich. Keine persönlichen Daten committen. Commits als `Claude <noreply@anthropic.com>`.
- Kein Impressum, solange die App rein privat genutzt wird (Nutzer + Freundin).
