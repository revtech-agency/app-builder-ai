# Pitch video build

Builds the three-minute VibeHack pitch video from deck slides, demo screenshots and generated narration, plus the 0:30–2:00 demo cut used on slide 5 at the finals. The timeline and voiceover follow the shot list (deck version 73).

| File                                           | What it does                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `build.py`                                     | The timeline (`FRAMES`) and narration cues (`CUES`). On its own it builds the plain version with a macOS `say` voice.                       |
| `build_dynamic.py`                             | The final version: eased zoom/pan to what is being narrated, highlight boxes, transitions, optional background music.                       |
| `kokoro_cues.py`                               | Generates each narration cue with the Kokoro `am_michael` voice, sped up per cue until it fits before the next one.                         |
| `make_music.py`                                | Generates the background pad (C – Am – F – G) from sine waves with ffmpeg, so it is royalty-free by construction.                           |
| `render-captions.mjs`, `render-highlights.mjs` | Render the caption bars, the "synthetic demo data" badge and the highlight boxes as transparent PNGs (this ffmpeg build has no `drawtext`). |

## Inputs (not in git)

All 1920×1080 PNGs, in this folder:

- `slides/S1.png` … `S4.png`, `S6.png` … `S8.png`: the deck slides.
- `shots/`: the demo screenshots, with the file names listed in `FRAMES` in `build_dynamic.py` (`D1a-intake-demo-cards.png` … `D5a-gmail-result-email.png`). They show the inbox, n8n, HubSpot and the app, so they stay out of the repo. Capture them at 1920×1080 from one real run of the demo.

## Set up (macOS)

```sh
brew install ffmpeg espeak-ng uv
cd scripts/video
npm install --no-save playwright-core     # used with the installed Google Chrome (or set CHROME_PATH)
uv venv --python 3.12 .venv               # Kokoro needs Python 3.10–3.12
VIRTUAL_ENV=$PWD/.venv uv pip install "kokoro>=0.9.4" soundfile \
  https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
```

`kokoro_cues.py` points Kokoro at Homebrew's espeak-ng: the library bundled with the `espeakng-loader` wheel has its CI build path compiled in and exits without an error message. The first Kokoro run downloads the model (about 330 MB).

## Build

```sh
cd scripts/video
mkdir -p build/vo-kokoro out
.venv/bin/python kokoro_cues.py build.py build/vo-kokoro      # narration, prints the speed each cue needed
python3 make_music.py build/music.wav 178                     # background music, 178 s
python3 build_dynamic.py out build/vo-kokoro build/music.wav  # writes the two videos to out/
```

Output: `out/AppBuilder.ai-pitch-video.mp4` (2:58) and `out/AppBuilder.ai-demo-0m30-2m00.mp4` (1:30). Rendered shots are cached in `build/dyn/NN.mp4`; delete one to re-render it after changing its screenshot, zoom or highlight.

## Timing rules

- Every cue must end before the next one starts. `kokoro_cues.py` speeds a cue up in 0.05 steps from 1.15× and stops above 1.4×; `build_dynamic.py` checks again and stops if a clip overruns.
- Each transition overlaps the start of the next frame, so frame start times (and the narration cues) stay where `FRAMES` puts them.
- The demo cut runs from 30.4 s to 120.4 s: the black midpoints of the fades into and out of the demo.
- Captions name what is on screen. The first n8n frame discloses that the wait for the mailbox check is cut, and HubSpot is labelled as standing in for the bank's ERP.
