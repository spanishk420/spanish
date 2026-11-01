"""Erzeugt die Sprachaufnahmen der App (audio/) mit KI-Stimmen, offline.

Spanisch: Kokoro (Stimme em_alex), Deutsch: Piper (de_DE-thorsten-high).
Benötigt: pip install kokoro-onnx piper-tts soundfile; ffmpeg.
Modelle (GitHub-Releases):
  kokoro-onnx  model-files-v1.0: kokoro-v1.0.int8.onnx, voices-v1.0.bin
  k2-fsa/sherpa-onnx  tts-models: vits-piper-de_DE-thorsten-high.tar.bz2

Aufruf: python3 tools/gen_audio.py TEXTE.json KOKORO_DIR THORSTEN_DIR
TEXTE.json = [["es","hablar"],["de","sprechen"],...] (aus CHAPTERS, siehe CLAUDE.md)
Schreibt audio/<lang>/<name>.mp3 und audio/manifest.json; vorhandene Dateien werden übersprungen.
"""
import json, re, subprocess, sys, tempfile, unicodedata, wave, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
texts_file, kokoro_dir, thorsten_dir = sys.argv[1:4]
texts = json.loads(pathlib.Path(texts_file).read_text(encoding="utf-8"))

def tts_text(text, lang):
    # Muss zu ttsText() in src/base.html passen
    if lang == "es":
        return re.sub(r"\s*/\s*", ", ", text) + "."
    return re.sub(r"\s*/\s*", " oder ", text) + "."

def slug(text):
    t = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "x"

kokoro = piper = None
def synth(lang, text, wav_path):
    global kokoro, piper
    if lang == "es":
        if kokoro is None:
            from kokoro_onnx import Kokoro
            kokoro = Kokoro(f"{kokoro_dir}/kokoro-v1.0.int8.onnx", f"{kokoro_dir}/voices-v1.0.bin")
        import soundfile as sf
        samples, rate = kokoro.create(text, voice="em_alex", speed=0.9, lang="es")
        sf.write(wav_path, samples, rate)
    else:
        if piper is None:
            from piper import PiperVoice
            m = "de_DE-thorsten-high"
            piper = PiperVoice.load(f"{thorsten_dir}/{m}.onnx", config_path=f"{thorsten_dir}/{m}.onnx.json")
        with wave.open(wav_path, "wb") as w:
            piper.synthesize_wav(text, w)

# Stille am Anfang/Ende abschneiden, damit die Antwort sofort kommt; mono MP3
TRIM = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
        "silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08")
manifest = {}
with tempfile.TemporaryDirectory() as tmp:
    for lang, text in texts:
        key = f"{lang}|{text.strip()}"
        if key in manifest:
            continue
        rel = f"{lang}/{slug(text)}.mp3"
        out = root / "audio" / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if not out.exists():
            wav = f"{tmp}/x.wav"
            synth(lang, tts_text(text, lang), wav)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-af", TRIM,
                            "-ac", "1", "-b:a", "64k", str(out)], check=True)
            print("neu:", rel)
        manifest[key] = rel
(root / "audio" / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=0), encoding="utf-8")
print(len(manifest), "Aufnahmen")
