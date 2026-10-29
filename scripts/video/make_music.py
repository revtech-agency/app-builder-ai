"""Generates a soft ambient pad (C - Am - F - G) with ffmpeg sine sources: royalty-free by construction.

Usage: make_music.py OUT.wav SECONDS
"""
import subprocess
import sys

OUT, SECONDS = sys.argv[1], float(sys.argv[2])
CHORD_SECS, XFADE = 8.0, 2.0
# Root-position triads plus the octave, low register.
CHORDS = {
    "C": [130.81, 164.81, 196.00, 261.63],
    "Am": [110.00, 130.81, 164.81, 220.00],
    "F": [87.31, 130.81, 174.61, 220.00],
    "G": [98.00, 123.47, 146.83, 196.00],
}
ORDER = ["C", "Am", "F", "G"]


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def chord_expr(freqs):
    # Each note twice, the second slightly detuned, with a slow swell; quieter upper notes.
    terms = []
    for k, f in enumerate(freqs):
        amp = 0.16 / (1 + 0.5 * k)
        terms.append(f"{amp}*sin(2*PI*{f}*t)")
        terms.append(f"{amp * 0.6}*sin(2*PI*{f * 1.004}*t+1.3)")
    return f"({'+'.join(terms)})*(0.85+0.15*sin(2*PI*0.25*t))"


length = CHORD_SECS + XFADE
for name in ORDER:
    run(["ffmpeg", "-y", "-f", "lavfi", "-i",
         f"aevalsrc='{chord_expr(CHORDS[name])}':s=48000:d={length}",
         "-af", f"afade=t=in:d={XFADE},afade=t=out:st={length - XFADE}:d={XFADE}", f"/tmp/pad-{name}.wav"])

# One cycle of four chords with crossfades, then loop it to length, add space and roll off the top.
inputs = sum((["-i", f"/tmp/pad-{n}.wav"] for n in ORDER), [])
graph = (f"[0][1]acrossfade=d={XFADE}[a];[a][2]acrossfade=d={XFADE}[b];[b][3]acrossfade=d={XFADE}[cyc]")
run(["ffmpeg", "-y", *inputs, "-filter_complex", graph, "-map", "[cyc]", "/tmp/pad-cycle.wav"])
run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", "/tmp/pad-cycle.wav", "-t", str(SECONDS),
     "-af", f"aecho=0.8:0.6:120|260:0.25|0.15,lowpass=f=1800,highpass=f=60,"
            f"afade=t=in:d=3,afade=t=out:st={SECONDS - 4}:d=4,loudnorm=I=-30:TP=-6",
     "-ar", "48000", "-ac", "2", OUT])
print(OUT)
