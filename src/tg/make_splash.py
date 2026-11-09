"""Build the Telegram launch-screen icon: 512x512 SVG with ONE filled <path>.

BotFather stores only the path data (compressed like sticker vector thumbnails),
so strokes are converted to a filled outline, overlaps are merged, holes are
wound opposite to outer contours (same result for nonzero and evenodd), and the
path text uses only commands, digits, '-' and ',' (no spaces).
"""
import re
import subprocess
import sys

import numpy as np
import potrace
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "x02-splash-v2.svg"
S = 8  # trace at 8x resolution

STROKES = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#fff"/>
<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="34">
<path d="M70 150 Q 140 240 210 360"/>
<path d="M210 150 Q 150 245 70 362"/>
<path d="M362 140 C 418 140 436 214 432 262 C 428 316 398 372 352 368 C 304 364 284 316 288 256 C 292 196 318 142 370 146"/>
</g></svg>"""


def render(svg_text, px, png):
    src = png.replace(".png", ".svg")
    with open(src, "w") as f:
        f.write(svg_text)
    subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), "-b", "white", src, "-o", png], check=True)
    return np.array(Image.open(png).convert("L")) < 128


ink = render(STROKES, 512 * S, "/tmp/splash_strokes.png")
plist = potrace.Bitmap(~ink).trace(  # potracer: 0 = ink, 1 = paper
    turdsize=20, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
    alphamax=1.0, opticurve=True, opttolerance=1.6)


def pt(p):  # point in tenths of a unit (integers, so relative steps never drift)
    x, y = (p.x, p.y) if hasattr(p, "x") else p
    return (round(x * 10 / S), round(y * 10 / S))


def n(t):  # tenths -> shortest decimal text
    return str(t // 10) if t % 10 == 0 else f"{t / 10:.1f}"


def area(poly):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]))


parts, info = [], []
for curve in plist:
    cur = start = pt(curve.start_point)
    cmds, poly = [f"M{n(cur[0])},{n(cur[1])}"], [cur]
    for seg in curve.segments:
        if seg.is_corner:
            for q in (pt(seg.c), pt(seg.end_point)):
                cmds.append(f"l{n(q[0]-cur[0])},{n(q[1]-cur[1])}")
                cur = q
                poly.append(q)
        else:
            c1, c2, e = pt(seg.c1), pt(seg.c2), pt(seg.end_point)
            cmds.append("c" + ",".join(n(v) for v in (
                c1[0]-cur[0], c1[1]-cur[1], c2[0]-cur[0], c2[1]-cur[1], e[0]-cur[0], e[1]-cur[1])))
            cur = e
            poly.append(e)
    cmds.append("z")
    parts.append("".join(cmds))
    info.append((len(curve.segments), area(poly) / 100))

d = "".join(parts)
svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
       f'<path d="{d}"/></svg>\n')
with open(OUT, "w") as f:
    f.write(svg)

# ---- checks ----
assert svg.count("<path") == 1, "must be exactly one <path>"
bad = set(d) - set("ACHLMQSTVZachlmqstvz.0123456789-,")
assert not bad, f"unexpected characters in path: {bad}"

ref = render(STROKES, 512, "/tmp/splash_ref.png")
nz = render(svg, 512, "/tmp/splash_nonzero.png")
eo = render(svg.replace("<path ", '<path fill-rule="evenodd" '), 512, "/tmp/splash_evenodd.png")
iou = (ref & nz).sum() / (ref | nz).sum()
rule_diff = (nz != eo).sum()

print(f"file: {OUT}  {len(svg.encode())} bytes, path {len(d)} chars, {len(plist)} contours")
for i, (n, a) in enumerate(info):
    print(f"  contour {i}: {n:2d} segments, signed area {a:9.0f}")
print(f"IoU vs original strokes: {iou:.4f}   nonzero vs evenodd differing pixels: {rule_diff}")
assert iou > 0.97 and rule_diff == 0
