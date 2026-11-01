"""Baut index.html der App aus der bisherigen Karteikarten-Seite plus Sprachmodus."""
import re, sys, pathlib

src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
here = pathlib.Path(__file__).parent
out = here.parent / "index.html"
voice_js = (here / "voice.js").read_text(encoding="utf-8")
version = re.search(r'espanol-v(\d+)', (here.parent / "sw.js").read_text(encoding="utf-8")).group(1)

def rep(s, old, new, count=1):
    assert s.count(old) == count, (old[:60], s.count(old))
    return s.replace(old, new)

head = """<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Español ¡ya!</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#1F4C9A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Español">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="icons/icon-192.png">
"""
s = src
s = rep(s, '<title>Verbos Karteikarten</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n', head)

base_css = """*,*::before,*::after{box-sizing:border-box}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}
body{margin:0;font-size:16px;line-height:1.35}
[hidden]{display:none!important}
"""
s = rep(s, "<style>\n", "<style>\n" + base_css)
s = rep(s, "html,body{height:100%}", "html,body{height:100%}\nhtml{height:100dvh}")

voice_css = """
/* Sprachmodus */
.mic{font-size:.95rem;font-weight:700;border-radius:14px;padding:12px;border:0;background:var(--azul);color:var(--surface);white-space:nowrap}
.vcard{flex:1;min-height:220px;background:var(--surface);border-radius:22px;border:1px solid var(--line);display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;padding:40px 20px 24px;position:relative;gap:12px}
.vstatus{font-weight:700;font-size:1.05rem;border-radius:14px;padding:12px 16px;background:var(--azul-soft);color:var(--azul);text-align:center;line-height:1.35}
.vstatus.listen{background:var(--sol-soft);color:var(--ink);animation:pulse 1.4s ease-in-out infinite}
.vstatus.good{background:var(--ok-soft);color:var(--ok)}
.vstatus.bad{background:var(--no-soft);color:var(--no)}
@keyframes pulse{50%{box-shadow:0 0 0 6px var(--sol-soft)}}
.vheard{color:var(--muted);font-size:.95rem;min-height:1.3em}
.vbig{grid-column:1/-1;font-size:1.3rem;padding:26px 10px}
.vmicbtn{grid-column:1/-1;background:var(--surface);color:var(--ink);border:1px solid var(--line)}
.vmicbtn[aria-pressed="true"]{border-color:var(--azul);color:var(--azul)}
.gear{font-size:1.25rem;line-height:1;background:none;border:1px solid var(--line);border-radius:999px;width:38px;height:38px;padding:0;color:var(--muted);flex:0 0 auto}
.home-title{flex:1;min-width:0}
.sbox{display:flex;flex-direction:column;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px}
.sbox h2{font-family:var(--f-display);font-size:1.1rem;margin:0}
.sbox p{margin:0;color:var(--muted);font-size:.88rem;line-height:1.45}
.vdiag{color:var(--muted);font-size:.8rem;line-height:1.4;text-align:center;min-height:1em}
.vdiag:empty{display:none}
.vtip{margin:0;color:var(--muted);font-size:.82rem;line-height:1.45;text-align:center}
@media (prefers-reduced-motion:reduce){.vstatus.listen{animation:none}}
"""
s = rep(s, "@media (prefers-reduced-motion:reduce){.bar i", voice_css + "@media (prefers-reduced-motion:reduce){.bar i")

# Sprachmodus-Knopf im Kapitel
s = rep(s, '  <div class="stats">\n    <div class="stat"><b id="sKnown">', '  <button class="mic" id="voiceBtn" type="button">🎙️ Sprachmodus: sprechen statt tippen</button>\n  <div class="stats">\n    <div class="stat"><b id="sKnown">')
s = rep(s, '<p class="intro">Wähl ein Kapitel. Jedes Wort wird in beide Richtungen abgefragt, und was du oft nicht weißt, kommt öfter dran.</p>',
        '<p class="intro">Wähl ein Kapitel. Jedes Wort wird in beide Richtungen abgefragt, und was du oft nicht weißt, kommt öfter dran. Im Kapitel startest du mit <b>🎙️ Sprechen</b> den Sprachmodus, ganz ohne Tippen.</p>')

voice_html = """
<div class="app" id="voice" hidden>
  <header>
    <button class="ghost" id="vBack" type="button">‹ Beenden</button>
    <span class="chname" id="vmName"></span>
    <span class="hgroup"><span class="stat ok" style="padding:4px 10px"><b id="vOk" style="font-size:1rem">0</b></span><span class="stat no" style="padding:4px 10px"><b id="vNo" style="font-size:1rem">0</b></span></span>
  </header>
  <div class="vcard">
    <div class="tag" id="vTag"></div>
    <div class="swatch" id="vSw" hidden></div>
    <div class="q" id="vQ">Bereit?</div>
    <div class="answer" id="vAns" hidden><div class="a" id="vA"></div></div>
    <div class="vheard" id="vHeard"></div>
  </div>
  <div class="vstatus" id="vStatus" role="status" aria-live="polite"></div>
  <div class="actions">
    <button class="btn show vbig" id="vStart" type="button">▶ Start</button>
    <button class="btn no vbig" id="vPause" type="button" hidden>⏸ Pause</button>
    <button class="btn vmicbtn" id="vMic" type="button" aria-pressed="true">🎙️ Mikrofon an</button>
  </div>
  <div class="vdiag" id="vDiag"></div>
  <p class="vtip">Mikro geht nicht? Teste es über ⚙️ Einstellungen auf der Startseite. Sag „nochmal“, um das Wort erneut zu hören, „weiß nicht“ zum Überspringen und „Stopp“ zum Anhalten.</p>
</div>
"""
settings_html = """
<div class="app" id="settings" hidden>
  <header>
    <button class="ghost" id="sBack" type="button">‹ Zurück</button>
    <span class="chname">Einstellungen</span>
    <span style="width:60px"></span>
  </header>
  <div class="sbox">
    <h2>🎙️ Mikrofon testen</h2>
    <p>Prüft, ob die Spracherkennung für den Sprachmodus funktioniert. Tippe auf den Knopf und sag etwas auf Deutsch.</p>
    <div class="vstatus" id="sStatus" role="status" aria-live="polite"></div>
    <div class="vheard" id="sHeard"></div>
    <button class="btn show" id="sTest" type="button">🧪 Mikro testen</button>
    <div class="vdiag" id="sDiag"></div>
  </div>
  <details class="sbox">
    <summary><b>Alle Stimmen anzeigen</b></summary>
    <pre id="sVoices" style="white-space:pre-wrap;font-size:.72rem;line-height:1.5;margin:8px 0 0;color:var(--muted)"></pre>
  </details>
  <p class="vtip">Version """ + version + """</p>
</div>
"""
s = rep(s, "\n<script>\n", voice_html + settings_html + "\n<script>\n")
s = rep(s, '<header><h1>Español <span>¡ya!</span></h1>',
        '<header><button class="gear" id="settingsBtn" type="button" aria-label="Einstellungen">⚙️</button><h1 class="home-title">Español <span>¡ya!</span></h1>')

# Ansichten: Sprachmodus ausblenden, wenn Kapitel/Übersicht gezeigt wird
s = rep(s, 'function show(view){$("home").hidden=view!=="home";$("train").hidden=view!=="train";',
        'function show(view){$("home").hidden=view!=="home";$("train").hidden=view!=="train";$("voice").hidden=true;$("settings").hidden=true;')

s = rep(s, "state=load();show(\"home\");\n</script>",
        voice_js + "\nstate=load();show(\"home\");\n"
        "if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));\n</script>\n</body>\n</html>")
s = rep(s, "</style>\n", "</style>\n</head>\n<body>\n")
# Aufnahmen-Liste einsetzen (audio/manifest.json, erzeugt von tools/gen_audio.py)
import json
mf = here.parent / "audio" / "manifest.json"
audio_map = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
s = rep(s, "const AUDIO={};", "const AUDIO=" + json.dumps(audio_map, ensure_ascii=False, separators=(",", ":")) + ";")
out.write_text(s, encoding="utf-8")
print("wrote", out, len(s))
