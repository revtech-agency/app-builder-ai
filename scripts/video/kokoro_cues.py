"""Generates the narration cues from video/build.py with a Kokoro voice, one WAV per cue.

Each cue starts at BASE_SPEED and is sped up in small steps until it ends before the next cue
(or the end of the timeline). Stops if a cue would need more than MAX_SPEED.
"""
import ast
import re
import sys

import espeakng_loader
import numpy as np
import soundfile as sf

# Same espeak-ng workaround as kokoro_sample.py: the bundled library exits on its CI build path.
BREW = "/opt/homebrew/opt/espeak-ng"
espeakng_loader.get_library_path = lambda: f"{BREW}/lib/libespeak-ng.dylib"
espeakng_loader.get_data_path = lambda: f"{BREW}/share/espeak-ng-data"

from kokoro import KPipeline  # noqa: E402

BUILD_PY, OUT_DIR = sys.argv[1], sys.argv[2]
VOICE, LANG = "am_michael", "a"
BASE_SPEED, STEP, MAX_SPEED = 1.15, 0.05, 1.4
GAP = 0.15  # seconds of silence left before the next cue
RATE = 24000

src = open(BUILD_PY).read()
cues = ast.literal_eval(re.search(r"CUES = (\[.*?\n\])\n", src, re.S).group(1))
total = sum(ast.literal_eval(m)[1] for m in re.findall(r'^\s*(\(".*?\)),\s*$', re.search(r"FRAMES = \[(.*?)\n\]\n", src, re.S).group(1).replace("N8N_CROP", "None"), re.M))

pipe = KPipeline(lang_code=LANG, repo_id="hexgrad/Kokoro-82M")
for i, (start, text, _) in enumerate(cues):
    spoken = text.replace("n8n", "n eight n")
    limit = (cues[i + 1][0] if i + 1 < len(cues) else total) - start - GAP
    speed = BASE_SPEED
    while True:
        audio = np.concatenate([a for _, _, a in pipe(spoken, voice=VOICE, speed=speed)])
        secs = len(audio) / RATE
        if secs <= limit:
            break
        speed = round(speed + STEP, 2)
        if speed > MAX_SPEED:
            raise SystemExit(f"cue {i} needs more than {MAX_SPEED}x ({secs:.1f}s for {limit:.1f}s): {text[:50]}")
    sf.write(f"{OUT_DIR}/{i:02d}.wav", audio, RATE)
    print(f"cue {i:02d} at {start:6.1f}s  {secs:5.1f}s / {limit:5.1f}s  speed {speed}")
print(f"timeline {total}s")
