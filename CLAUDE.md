# Clonelingo – Projektnotizen

(Früher „Español ¡ya!“; seit 1.11.2026 heißt die App Clonelingo.)

Spanisch-Lern-App (PWA) für eine*n deutschsprachige*n Anfänger*in, läuft auf GitHub Pages:
https://spanishk420.github.io/spanish/ – auf dem iPhone über Safari „Zum Home-Bildschirm“ installiert.
Kommunikation mit dem Nutzer auf Deutsch, locker, kurze Antworten.

## Aufbau
- `index.html` wird GEBAUT, nicht direkt bearbeiten: `python3 src/build.py src/base.html`
  - `src/base.html`: Karteikarten-App (Kapitel, Daten, Karteikarten-Logik, Stimmen-Auswahl, Reset)
  - `src/voice.js`: Sprachmodus (Vorlesen per speechSynthesis, Spracherkennung per webkitSpeechRecognition)
  - `src/game.js` + `src/game.css`: Lernpfad (Startseite) und Lektionen im Duolingo-Stil. Aufbau angelehnt an sanidhyy/duolingo-clone (MIT) – nur Code-Ideen übernommen, KEINE Bilder/Sounds aus dem Repo (vermutlich Duolingo-Material).
  - `src/build.py`: fügt PWA-Head, Sprachmodus-HTML/CSS, voice.js, game.js/css, Aufnahmen-Liste und Version in base.html ein
  - Einstellungen (#settings) stehen in base.html, bewusst knapp: 🔇 Kein Sound (Schalter), Karteikarten vorlesen, 🎙️ Mikrofon „Testen“, Fortschritt zurücksetzen.
  - Kein Sound (`muted`, localStorage `clonelingo-mute`, auch 🔊/🔇 im Lektionskopf): Lektionen spielen nichts ab, Hör-Aufgaben werden beim Anzeigen durch pickEs ersetzt; Karteikarten lesen nicht vor. Sprachmodus ignoriert es (ist reines Audio).
- `sw.js`: Service Worker (network-first, eigene Dateien mit `cache: "no-cache"`, weil GitHub Pages 10 Min. Browser-Cache setzt). Bei Änderungen die Cache-Version (`espanol-vN`) hochzählen – sie wird auch als „Version N“ in den Einstellungen angezeigt.
- `manifest.webmanifest`, `icons/`: PWA-Metadaten, Icon „ñ“ mit Sonne.
- `robots.txt` + `<meta name="robots" content="noindex">`: Seite soll nicht in Suchmaschinen auftauchen (bewusst, privat).

## Kapitel
Wunsch des Nutzers (1.11.2026): erst sehr vokabellastig, einzelne Wörter. Lernpfad (UNITS in game.js):
1. Verben (`verbs`, 30) · 2. Dinge im Haushalt (`house`, 30) · 3. Farben (`colors`, 19, inkl. der früheren „Weitere Farben“) · 4. Dinge in der Stadt (`city`, 30) · 5. „Kommt bald“ (Nutzer legt noch fest).
Geparkt (in CHAPTERS + Aufnahmen vorhanden, aber nicht im Pfad): `numbers`, `hello`, `meet`, `cafe`, `travel`. Spanien-Spanisch (coche, nevera, Correos …).
Substantive immer mit Artikel. Beim Tippen: Artikel weglassen = richtig, falscher Artikel = „fast richtig“ (gelb).
Einträge in CHAPTERS: [Deutsch, Spanisch, Hinweis, Eselsbrücke, Startlevel 0–4, Farbe]. Leere Eselsbrücke wird ausgeblendet.
Startseite = Lernpfad: pro Kapitel eine Einheit mit Lektionen (5 Wörter; Zahlen in Bereichen) + 👑 Wiederholung. Lektionen pro Einheit nacheinander freigeschaltet. „📇 Üben“ im Einheiten-Banner öffnet die alten Karteikarten (dort auch Sprachmodus).
Aufgabentypen: pickDe (Spanisch → Bedeutung wählen), pickEs, listen (Aufnahme hören), color (Farbfeld wählen), type (Spanisch schreiben, nur bis 2 Wörter), build (Satz aus Wort-Kacheln, ab 3 Wörtern). Bei Fehlern wird die Eselsbrücke gezeigt. Schreibaufgaben: nur Akzent/ñ falsch oder ein Buchstabe vertippt (ab 4 Zeichen) = „fast richtig“ (gelb, kein Herzverlust, Aufgabe kommt nochmal), siehe grade3().
Pfad scrollt beim Öffnen zur nächsten Lektion der zuletzt gespielten Einheit (game.lastUnit).
👹 Boss am Ende jedes Kapitels (nach 👑 Wiederholung): 12 Aufgaben nur type/build und listenType (hören + schreiben), schwache Wörter bevorzugt, 3 Herzen, +20 XP. Sieg setzt game.boss[ch] und schaltet das nächste Kapitel frei. Kapitel offen = erstes Kapitel, Boss davor besiegt, oder schon angefangen (alter Fortschritt).
🌅 Tägliche Auffrischung: ab 4 gelernten Wörtern (= Wörter aus geschafften Lektionen). Beim ersten Öffnen des Tages ein Hinweis-Fenster (game.refreshPrompt), dazu oben im Pfad eine Karte. 10 Wörter, gewichtet nach Fehlern (miss) und niedrigem Level, gemischte Aufgaben. Erledigt: game.refreshDay. 5 Herzen pro Lektion, falsche Aufgaben kommen am Ende nochmal. XP = 1 pro Aufgabe (+5 ohne Fehler), Tagesziel 30 XP, Serie 🔥 in Tagen.
Fortschritt nur in localStorage: Karten-Level `verbos-v2` (wird auch von Lektionen aktualisiert), Spielstand `espanol-game-v1` (xp, done, streak). Gewichtung: niedriges Level und häufiges „nicht gewusst“ kommen öfter dran.

## Sprachmodus – Wünsche des Nutzers
- Für unterwegs/Auto, ohne Tippen.
- Mikrofon: kein Siri-Piepton gewünscht – aber durchgehende Erkennung + gleichzeitige Sprachausgabe hat auf dem iPhone „erkennt nichts“ ergeben. Seit 31.10.2026: Mikro pro Antwort frisch gestartet (nach der Ansage, nie während TTS), Zwischenergebnisse werden sofort ausgewertet. Karten in 5er-Blöcken pro Richtung.
- Neues Wort wird einmal in seiner Sprache vorgelesen (Deutsch → deutsche Stimme, Spanisch → spanische Stimme, Zahlen deutsch).
- Richtig → nur Sound (Pling), sofort weiter. Falsch → tiefer Sound + richtige Lösung. Sounds als WAV im JS erzeugt, über <audio> (spielt auch bei Stummschalter).
- Stimme soll menschlich klingen. iOS-Safari gibt Webseiten NUR compact-Stimmen (Premium/Erweitert unsichtbar, per Stimmenliste in ⚙️ bestätigt). Deshalb: alle Wörter als KI-Aufnahmen in `audio/` (Spanisch: Kokoro `em_alex`, Deutsch: Piper `de_DE-thorsten-high`, vom Nutzer ausgewählt). Erzeugen mit `tools/gen_audio.py` (Anleitung im Kopf der Datei; Modelle über GitHub-Releases, HuggingFace ist aus dem Container gesperrt). Texteliste = für jedes Item ["es", v[1]] und ["de", v[0]] (Zahlen: Ziffern ohne Punkt) plus jede Kachel `tilesOf(v[1])` einzeln als ["es", wort]. `build.py` setzt `audio/manifest.json` als `AUDIO` ein. Fehlt eine Aufnahme → speechSynthesis. Neue Wörter/Kapitel ⇒ Aufnahmen nachgenerieren. Der Service Worker lädt alle Aufnahmen bei Installation vor (offline im Auto).
- Erkennung tolerant (z. B. „abla“/„habla“ = hablar), aber ähnliche falsche Wörter ablehnen (ver ≠ beber, correr ≠ comer).
- TTS: Nutzer meldete deutsche Stimme für spanische Wörter → Stimme wird jetzt immer explizit gesetzt und frisch aus getVoices() geholt (iOS liefert die Liste verzögert); erstes speak() synchron im Start-Tipp.
- Diagnose: im Sprachmodus Zeile mit Stimmen / Mikro-Fehlern; „🧪 Mikro testen“ in ⚙️ Einstellungen (Zahnrad oben links auf der Startseite, Ansicht #settings in build.py). Nach 2 stillen Runden Hinweis (Home-Bildschirm-App vs. Safari, Siri & Diktieren).
- Offen: Bestätigung auf echtem iPhone, v. a. ob Erkennung in der Home-Bildschirm-App geht.

## Auto-Modus (`src/car.js`, Ansicht #car)
**Seit 1.11.2026 ausgeblendet** (Nutzer mag ihn nicht so): `SHOW_CAR=false` in game.js; Code bleibt, zum Wieder-Einblenden auf true setzen.
CarPlay kann keine Web-Apps; Mikrofon geht mit CarPlay nicht (Nutzer getestet). Echte CarPlay-App bräuchte native App + Apple-Entitlement, Lern-Apps passen in keine erlaubte Kategorie → stattdessen nur Hören.
Baut aus den Aufnahmen EINE WAV-Spur (OfflineAudioContext, 22 kHz mono): Frage → Pause (3–8 s) → Antwort → Antwort nochmal. Eine Datei, damit es bei gesperrtem Bildschirm weiterläuft; Media Session zeigt das Wort in CarPlay „Wird gespielt“ (Lösung erst ab Antwortzeit), ⏭/⏮ springen zwischen Wörtern. Quelle: gelernte Wörter (schwierige zuerst) oder ein offenes Kapitel; Richtung, Pause, Anzahl in localStorage `clonelingo-car`. Download als WAV möglich. Ignoriert „Kein Sound“. Tests brauchen http-Server (fetch geht nicht über file://).
Offen: ob iOS die Wiedergabe aus der Home-Bildschirm-App bei gesperrtem Bildschirm fortsetzt.

## Zoom
Zoomen ist auf Wunsch des Nutzers gesperrt: viewport `user-scalable=no`, `touch-action:manipulation` (Doppeltippen), gesturestart/touchmove mit 2 Fingern abgefangen (build.py). Kein touchend-Abfangen, das würde schnelle Tipps verschlucken. Eingabefelder brauchen ≥16px Schrift, sonst zoomt iOS beim Fokus.

## Privatsphäre
- Repo ist öffentlich. Keine persönlichen Daten committen. Commits als `Claude <noreply@anthropic.com>`.
- Kein Impressum, solange die App rein privat genutzt wird (Nutzer + Freundin).
