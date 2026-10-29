"""Builds the AppBuilder.ai pitch video from rendered slides, demo screenshots and macOS 'say' narration.

Timeline follows the shot list (deck version 84): slides 1-4 (0:00-0:30), demo D1-D5 (0:30-2:00),
slides 6-8 (2:00-2:58). Output: pitch.mp4 (full) and demo-cut.mp4 (0:30-2:00).
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = sys.argv[1]
# Optional: a folder of pre-generated narration clips (NN.wav, one per cue), e.g. from kokoro_cues.py.
CLIP_DIR = sys.argv[2] if len(sys.argv) > 2 else None
FPS = 30
VOICE = "Daniel"

# n8n canvas screenshots: crop to the canvas (drop the execution list) before scaling.
N8N_CROP = "crop=1568:893:352:150,scale=1920:-2,crop=1920:1080"

# (image, seconds, caption, crop filter or None)
FRAMES = [
    ("slides/S1.png", 8, None, None),
    ("slides/S2.png", 7, None, None),
    ("slides/S3.png", 7, None, None),
    ("slides/S4.png", 8, None, None),
    # D1 0:30-0:42
    ("shots/D1a-intake-demo-cards.png", 4.5, "AppBuilder.ai app · Email intake: send the “Clean match” demo invoice", None),
    ("shots/D1c-gmail-filtered.png", 3.5, "Accounts-payable inbox (Gmail), filtered to demo emails", None),
    ("shots/D1d-gmail-invoice-email.png", 4, "The supplier's email with the invoice PDF attached", None),
    # D2 0:42-1:04
    ("shots/D2a-n8n-execution.png", 3, "n8n · Process supplier invoices · the wait for the next mailbox check is cut", N8N_CROP),
    ("shots/D2c-n8n-zoom-01.png", 2, "n8n execution: every step ran (green)", N8N_CROP),
    ("shots/D2c-n8n-zoom-02.png", 2, "n8n execution: every step ran (green)", N8N_CROP),
    ("shots/D2d-n8n-read-document.png", 5, "Read Document: Claude extracts each field with a confidence score", None),
    ("shots/D2c-n8n-zoom-03.png", 2, "n8n execution: every step ran (green)", N8N_CROP),
    ("shots/D2e-n8n-apply-rules.png", 4.5, "Apply Rules: coded rules decide the stage, not the model", None),
    ("shots/D2c-n8n-zoom-04.png", 1.75, "n8n execution: every step ran (green)", N8N_CROP),
    ("shots/D2c-n8n-zoom-05.png", 1.75, "n8n execution: every step ran (green)", N8N_CROP),
    # D3 1:04-1:16
    ("shots/D3a-hubspot-board.png", 5, "HubSpot (stands in for the bank's ERP) · invoice pipeline", None),
    ("shots/D3c-hubspot-audit-note.png", 7, "Audit note: every check written on the record", None),
    # D4 1:16-1:46
    ("shots/D4a-app-queue.png", 5, "App · invoice queue: exceptions wait for a person, with the money held", None),
    ("shots/D4b-app-iban-invoice.png", 7, "Different IBAN → the whole amount held in Needs review", None),
    ("shots/D4c-app-qty-invoice.png", 6, "15 billed, 12 received → Waiting on supplier, the extra held", None),
    ("shots/D4e-gmail-supplier-request.png", 3.5, "The email to the supplier, drafted by the worker", None),
    ("shots/D4d-app-qty-draft-email.png", 3, "A person decides: approve, send back, mark duplicate or reject", None),
    ("shots/D4g-app-efactura.png", 5.5, "e-Factura intake (simulated SPV): the same 12 checks", None),
    # D5 1:46-2:00
    ("shots/D5a-gmail-result-email.png", 14, "Result email to the reviewer, with the money protected", None),
    # Slides 6-8 2:00-2:58
    ("slides/S6.png", 19, None, None),
    ("slides/S7.png", 19, None, None),
    ("slides/S8.png", 20, None, None),
]

# (start second, text, words per minute)
CUES = [
    (0.3, "We built an AI worker that checks every supplier invoice against its purchase order and delivery before a bank pays it.", 172),
    (8.1, "Today clerks check every line by hand. Our worker runs twelve checks, and a person approves every payment.", 185),
    (15.1, "It fits a wider gap: only 5 percent of Romanian firms use AI, against 20 percent in the EU.", 185),
    (22.3, "We charge per document handled, 1 euro 50 an invoice, not per seat, so revenue grows with the work.", 172),
    (30.45, "Here it runs, on synthetic data only.", 172),
    (33.6, "A supplier emails an invoice PDF to the accounts-payable inbox, in its own format.", 172),
    (42.3, "n8n picks it up.", 172),
    (47.6, "Only one step uses the model: Claude reads the invoice and scores each field.", 172),
    (55.6, "Then twelve coded rules decide, so every result is predictable and auditable.", 172),
    (61.1, "We cut the wait for the next mailbox check.", 172),
    (64.3, "HubSpot stands in for the bank's ERP.", 172),
    (68.0, "The invoice lands in Ready to approve, and every check is written on the record.", 172),
    (76.3, "Exceptions wait for a person, and the queue shows the money held.", 172),
    (81.3, "This invoice asks to be paid to a different IBAN, so the whole amount is held in Needs review.", 172),
    (88.3, "This one bills fifteen docking stations when twelve were received,", 172),
    (94.2, "so the extra goes back to the supplier.", 172),
    (97.8, "Open one: every check, and why.", 172),
    (100.8, "Romanian e-Factura invoices get the same checks, here from a simulated SPV inbox.", 172),
    (106.8, "And the reviewer gets the result by email: the money protected, who approves it, and every check ticked or crossed.", 172),
    (120.3, "Under the hood: n8n runs three flows, Claude Sonnet reads the documents, HubSpot holds the records and Lovable is the review screen. More agents would not help here. The decision has to be predictable and testable, so the rules are code.", 172),
    (139.3, "You can check all of it. Twelve synthetic test cases came out right on four runs in a row. The repo has the workflows, the test runner and one script that rebuilds the demo, and it is built to run on the bank's own approved tools.", 172),
    (158.3, "Every invoice is checked for duplicates, changed IBANs and overbilling before it is paid: up to 2 percent of supplier spend. Main limitation: synthetic data only. Next: a pilot with one bank accounts-payable team, measured in euros of risky payments held.", 172),
]

DEMO_START, DEMO_END = 30, 120


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def main():
    os.chdir(HERE)
    os.makedirs("build/seg", exist_ok=True)
    os.makedirs("build/vo", exist_ok=True)
    total = sum(f[1] for f in FRAMES)
    print(f"timeline {total:.2f}s")

    # Narration: one clip per cue, checked against the next cue's start.
    clips = []
    for i, (start, text, rate) in enumerate(CUES):
        if CLIP_DIR:
            f = os.path.join(CLIP_DIR, f"{i:02d}.wav")
        else:
            f = f"build/vo/{i:02d}.aiff"
            run(["say", "-v", VOICE, "-r", str(rate), "-o", f, text])
        d = duration(f)
        end_limit = CUES[i + 1][0] if i + 1 < len(CUES) else total
        if start + d > end_limit - 0.1:
            raise SystemExit(f"cue {i} ({d:.1f}s from {start}s) runs into {end_limit}s: {text[:50]}")
        clips.append((start, f))

    # Video: one segment per frame with a slow push-in, captions and the synthetic-data badge on demo shots.
    segs = []
    t = 0.0
    for i, (img, secs, caption, crop) in enumerate(FRAMES):
        n = round(secs * FPS)
        chain = []
        if crop:
            chain.append(crop)
        chain.append("scale=3840:2160")
        chain.append(f"zoompan=z='1+0.035*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1920x1080:fps={FPS}")
        seg = f"build/seg/{i:02d}.mp4"
        cmd = ["ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-i", img]
        if caption:
            # Caption bar + "synthetic demo data" badge, rendered by render-captions.mjs (this ffmpeg has no drawtext).
            cmd += ["-loop", "1", "-framerate", str(FPS), "-i", f"build/cap/{i:02d}.png",
                    "-filter_complex", f"[0:v]{','.join(chain)}[bg];[bg][1:v]overlay=0:0,format=yuv420p"]
        else:
            cmd += ["-vf", ",".join(chain + ["format=yuv420p"])]
        if not os.path.exists(seg):  # screens unchanged between voice rebuilds; reuse rendered segments
            run(cmd + ["-frames:v", str(n), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), seg])
        segs.append(seg)
        t += secs
        print(f"  {i:02d} {img} {secs}s -> {t:.2f}s")

    with open("build/segs.txt", "w") as fh:
        fh.writelines(f"file '{os.path.abspath(s)}'\n" for s in segs)
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "build/segs.txt", "-c", "copy", "build/video.mp4"])

    # Audio: place each clip at its cue, pad to the timeline, normalise loudness.
    cmd = ["ffmpeg", "-y"]
    for _, f in clips:
        cmd += ["-i", f]
    parts = [f"[{k}:a]aresample=48000,adelay={int(s * 1000)}:all=1[a{k}]" for k, (s, _) in enumerate(clips)]
    mix = "".join(f"[a{k}]" for k in range(len(clips)))
    parts.append(f"{mix}amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{total},loudnorm=I=-16:TP=-1.5:LRA=11[out]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s16le", "build/voice.wav"]
    run(cmd)

    pitch = os.path.join(OUT_DIR, "AppBuilder.ai-pitch-video.mp4")
    run(["ffmpeg", "-y", "-i", "build/video.mp4", "-i", "build/voice.wav", "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", pitch])
    demo = os.path.join(OUT_DIR, "AppBuilder.ai-demo-0m30-2m00.mp4")
    run(["ffmpeg", "-y", "-ss", str(DEMO_START), "-to", str(DEMO_END), "-i", pitch, "-c:v", "libx264", "-preset",
         "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", demo])
    for p in (pitch, demo):
        print(p, f"{duration(p):.2f}s")


if __name__ == "__main__":
    main()
