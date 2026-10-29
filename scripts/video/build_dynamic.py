"""Dynamic version of the pitch video: eased zoom/pan to the point being narrated, highlight boxes,
and transitions between shots. Same timeline and narration cues as build.py.

Usage: build_dynamic.py OUT_DIR CLIP_DIR [MUSIC_WAV]
With MUSIC_WAV, the music is mixed under the narration and ducks while the voice speaks.
"""
import ast
import json
import math
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR, CLIP_DIR = sys.argv[1], sys.argv[2]
MUSIC = sys.argv[3] if len(sys.argv) > 3 else None
FPS = 30
N8N_CROP = "crop=1568:893:352:150,scale=1920:-2,crop=1920:1080"
DEMO_CUT = (30.4, 120.4)  # black midpoints of the fades into and out of the demo


def push(z0=1.0, z1=1.05, fx=960, fy=540):
    return [(0, fx, fy, z0), (1, fx, fy, z1)]


def focus(fx, fy, z, hold=0.18, arrive=0.7):
    """Full view, then ease in on (fx, fy) at zoom z, then a slow drift."""
    return [(0, 960, 540, 1.0), (hold, 960, 540, 1.0), (arrive, fx, fy, z), (1, fx, fy, z * 1.03)]


# (image, seconds, caption, crop, keyframes [(t 0..1, centre x, centre y, zoom)], highlight boxes [x, y, w, h],
#  transition to the next frame (name, seconds))
FRAMES = [
    ("slides/S1.png", 8, None, None, push(1.06, 1.0), [], ("smoothleft", 0.6)),
    ("slides/S2.png", 7, None, None, push(1.0, 1.05, 760, 520), [], ("smoothleft", 0.6)),
    ("slides/S3.png", 7, None, None, push(1.0, 1.05, 1160, 520), [], ("smoothleft", 0.6)),
    ("slides/S4.png", 8, None, None, push(1.0, 1.05), [], ("fadeblack", 0.8)),
    # D1
    ("shots/D1a-intake-demo-cards.png", 4.5, "AppBuilder.ai app · Email intake: send the “Clean match” demo invoice", None,
     focus(708, 700, 1.8, hold=0.12, arrive=0.6), [[528, 588, 360, 215]], ("slideleft", 0.5)),
    ("shots/D1c-gmail-filtered.png", 3.5, "Accounts-payable inbox (Gmail), filtered to demo emails", None,
     focus(1000, 260, 1.5, hold=0.1, arrive=0.6), [[326, 170, 1536, 36]], ("fade", 0.4)),
    ("shots/D1d-gmail-invoice-email.png", 4, "The supplier's email with the invoice PDF attached", None,
     focus(640, 380, 1.7, hold=0.1, arrive=0.6), [[392, 401, 188, 128]], ("slideleft", 0.5)),
    # D2
    ("shots/D2a-n8n-execution.png", 3, "n8n · Process supplier invoices · the wait for the next mailbox check is cut", N8N_CROP,
     push(1.0, 1.25, 960, 560), [], ("fade", 0.6)),
    ("shots/D2c-n8n-zoom-01.png", 2, "n8n execution: every step ran (green)", N8N_CROP, push(1.0, 1.06), [], ("smoothleft", 0.5)),
    ("shots/D2c-n8n-zoom-02.png", 2, "n8n execution: every step ran (green)", N8N_CROP, push(1.0, 1.06), [], ("circleopen", 0.5)),
    ("shots/D2d-n8n-read-document.png", 5, "Read Document: Claude extracts each field with a confidence score", None,
     focus(1520, 760, 1.7, hold=0.15, arrive=0.55), [[1185, 803, 682, 172]], ("fade", 0.4)),
    ("shots/D2c-n8n-zoom-03.png", 2, "n8n execution: every step ran (green)", N8N_CROP, push(1.0, 1.06), [], ("circleopen", 0.5)),
    ("shots/D2e-n8n-apply-rules.png", 4.5, "Apply Rules: coded rules decide the stage, not the model", None,
     focus(1150, 330, 1.5, hold=0.15, arrive=0.6), [[1293, 142, 120, 76]], ("fade", 0.4)),
    ("shots/D2c-n8n-zoom-04.png", 1.75, "n8n execution: every step ran (green)", N8N_CROP, push(1.0, 1.06), [], ("smoothleft", 0.5)),
    ("shots/D2c-n8n-zoom-05.png", 1.75, "n8n execution: every step ran (green)", N8N_CROP, push(1.0, 1.06), [], ("slideleft", 0.5)),
    # D3
    ("shots/D3a-hubspot-board.png", 5, "HubSpot (stands in for the bank's ERP) · invoice pipeline", None,
     focus(990, 420, 1.6, hold=0.15, arrive=0.6), [[858, 300, 268, 180]], ("fade", 0.4)),
    ("shots/D3c-hubspot-audit-note.png", 7, "Audit note: every check written on the record", None,
     focus(1000, 530, 1.6, hold=0.12, arrive=0.5), [[700, 422, 600, 220]], ("slideleft", 0.5)),
    # D4
    ("shots/D4a-app-queue.png", 5, "App · invoice queue: exceptions wait for a person, with the money held", None,
     focus(835, 712, 1.55, hold=0.12, arrive=0.6), [[537, 461, 209, 98], [997, 693, 137, 271]], ("fade", 0.4)),
    ("shots/D4b-app-iban-invoice.png", 7, "Different IBAN → the whole amount held in Needs review", None,
     focus(1090, 690, 1.45, hold=0.1, arrive=0.45), [[537, 582, 1104, 132]], ("smoothleft", 0.5)),
    ("shots/D4c-app-qty-invoice.png", 6, "15 billed, 12 received → Waiting on supplier, the extra held", None,
     focus(1090, 700, 1.45, hold=0.1, arrive=0.5), [[537, 582, 1104, 112]], ("slideleft", 0.5)),
    ("shots/D4e-gmail-supplier-request.png", 3.5, "The email to the supplier, drafted by the worker", None,
     focus(640, 320, 1.6, hold=0.1, arrive=0.55), [[392, 266, 425, 40]], ("slideright", 0.5)),
    ("shots/D4d-app-qty-draft-email.png", 3, "A person decides: approve, send back, mark duplicate or reject", None,
     focus(1000, 760, 1.3, hold=0.1, arrive=0.6), [[526, 1012, 486, 52]], ("fade", 0.4)),
    ("shots/D4g-app-efactura.png", 5.5, "e-Factura intake (simulated SPV): the same 12 checks", None,
     focus(1080, 470, 1.4, hold=0.1, arrive=0.55), [[760, 199, 118, 34], [529, 665, 1104, 62]], ("slideleft", 0.5)),
    # D5: outcome and money first, then down to the checks
    ("shots/D5a-gmail-result-email.png", 14, "Result email to the reviewer, with the money protected", None,
     [(0, 960, 540, 1.0), (0.1, 960, 540, 1.0), (0.35, 720, 320, 1.7), (0.5, 720, 320, 1.7), (0.85, 720, 800, 1.7),
      (1, 720, 800, 1.74)], [[396, 294, 644, 62], [396, 742, 644, 214]], ("fadeblack", 0.8)),
    ("slides/S6.png", 19, None, None, push(1.0, 1.05, 960, 600), [], ("smoothleft", 0.6)),
    ("slides/S7.png", 19, None, None, push(1.0, 1.05, 960, 600), [], ("smoothleft", 0.6)),
    ("slides/S8.png", 20, None, None, push(1.0, 1.05, 960, 600), [], None),
]


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if r.returncode:
        raise SystemExit(f"command failed:\n{' '.join(cmd)[:400]}\n{r.stderr[-1500:]}")


def duration(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                                capture_output=True, text=True, check=True).stdout)


def curve(keys, idx, frames):
    """ffmpeg expression for keyframe value idx (1=x, 2=y, 3=zoom), cosine-eased between keys."""
    s = f"(on/{max(frames - 1, 1)})"
    expr = str(keys[-1][idx])
    for (p0, *a), (p1, *b) in reversed(list(zip(keys, keys[1:]))):
        v0, v1 = a[idx - 1], b[idx - 1]
        e = f"(1-cos(PI*({s}-{p0})/{p1 - p0}))/2"
        expr = f"if(lt({s},{p1}),{v0}+({v1 - v0})*{e},{expr})"
    return expr


def main():
    os.chdir(HERE)
    os.makedirs("build/dyn", exist_ok=True)
    src = open("build.py").read()
    cues = ast.literal_eval(re.search(r"CUES = (\[.*?\n\])\n", src, re.S).group(1))
    total = sum(f[1] for f in FRAMES)

    # Caption bars, and highlight boxes drawn on the source image so they move with the zoom.
    json.dump([f[2] for f in FRAMES], open("build/captions.json", "w"), ensure_ascii=False)
    run(["node", "render-captions.mjs"])
    json.dump({str(i): f[5] for i, f in enumerate(FRAMES) if f[5]}, open("build/dyn/highlights.json", "w"))
    run(["node", "render-highlights.mjs"])

    segs = []
    for i, (img, secs, caption, crop, keys, boxes, trans) in enumerate(FRAMES):
        length = secs + (trans[1] if trans else 0)  # each transition overlaps the next frame
        n = round(length * FPS)
        src_chain = ([crop] if crop else [])
        inputs = ["-loop", "1", "-framerate", str(FPS), "-i", img]
        graph = f"[0:v]{','.join(src_chain + ['null'])}[s0]"
        last = "s0"
        k = 1
        if boxes:
            inputs += ["-loop", "1", "-framerate", str(FPS), "-i", f"build/dyn/hl{i:02d}.png"]
            graph += f";[{last}][{k}:v]overlay=0:0[s1]"
            last, k = "s1", k + 1
        zx, zy, zz = curve(keys, 1, n), curve(keys, 2, n), curve(keys, 3, n)
        graph += (f";[{last}]scale=3840:2160,zoompan=z='{zz}'"
                  f":x='max(0,min(iw-iw/zoom,({zx})*2-iw/zoom/2))'"
                  f":y='max(0,min(ih-ih/zoom,({zy})*2-ih/zoom/2))'"
                  f":d={n}:s=1920x1080:fps={FPS}[z]")
        last = "z"
        if caption:
            inputs += ["-loop", "1", "-framerate", str(FPS), "-i", f"build/cap/{i:02d}.png"]
            graph += f";[{last}][{k}:v]overlay=0:0[c]"
            last = "c"
        graph += f";[{last}]format=yuv420p[out]"
        seg = f"build/dyn/{i:02d}.mp4"
        if not os.path.exists(seg):  # reuse rendered shots; delete build/dyn/NN.mp4 to re-render one
            run(["ffmpeg", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-frames:v", str(n),
                 "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), seg])
        segs.append(seg)
        print(f"  {i:02d} {img} {length:.2f}s")

    # Chain the segments with xfade; transition k starts at the original start of frame k+1.
    cmd = ["ffmpeg", "-y"]
    for s in segs:
        cmd += ["-i", s]
    parts, prev, t = [], "0:v", 0.0
    for i, f in enumerate(FRAMES[:-1]):
        t += f[1]
        name, d = f[6]
        out = f"v{i + 1}"
        parts.append(f"[{prev}][{i + 1}:v]xfade=transition={name}:duration={d}:offset={t:.3f}[{out}]")
        prev = out
    cmd += ["-filter_complex", ";".join(parts), "-map", f"[{prev}]", "-c:v", "libx264", "-preset", "medium",
            "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "build/dyn/video.mp4"]
    run(cmd)

    # Narration: the same clips and cue times as build.py.
    clips = []
    for i, (start, text, _) in enumerate(cues):
        f = os.path.join(CLIP_DIR, f"{i:02d}.wav")
        end = cues[i + 1][0] if i + 1 < len(cues) else total
        if start + duration(f) > end - 0.05:
            raise SystemExit(f"cue {i} runs into {end}s: {text[:50]}")
        clips.append((start, f))
    cmd = ["ffmpeg", "-y"]
    for _, f in clips:
        cmd += ["-i", f]
    parts = [f"[{k}:a]aresample=48000,adelay={int(s * 1000)}:all=1[a{k}]" for k, (s, _) in enumerate(clips)]
    parts.append("".join(f"[a{k}]" for k in range(len(clips))) +
                 f"amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{total},loudnorm=I=-16:TP=-1.5:LRA=11[out]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s16le", "build/dyn/voice.wav"]
    run(cmd)
    audio = "build/dyn/voice.wav"
    if MUSIC:
        # Music sits ~14 LU under the voice (make_music.py normalises it to -30 LUFS) and ducks further when it speaks.
        run(["ffmpeg", "-y", "-i", "build/dyn/voice.wav", "-i", MUSIC, "-filter_complex",
             "[0:a]aformat=channel_layouts=stereo,asplit=2[v][sc];"
             "[1:a][sc]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=700[md];"
             "[v][md]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]",
             "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s16le", "build/dyn/mix.wav"])
        audio = "build/dyn/mix.wav"

    pitch = os.path.join(OUT_DIR, "AppBuilder.ai-pitch-video.mp4")
    run(["ffmpeg", "-y", "-i", "build/dyn/video.mp4", "-i", audio, "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", pitch])
    demo = os.path.join(OUT_DIR, "AppBuilder.ai-demo-0m30-2m00.mp4")
    run(["ffmpeg", "-y", "-ss", str(DEMO_CUT[0]), "-to", str(DEMO_CUT[1]), "-i", pitch, "-c:v", "libx264", "-preset",
         "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", demo])
    for p in (pitch, demo):
        print(p, f"{duration(p):.2f}s")


if __name__ == "__main__":
    main()
