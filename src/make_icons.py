from PIL import Image, ImageDraw
import math
def icon(size, pad_frac, path, rounded=True):
    S = 4  # supersample
    W = size * S
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bg = (246, 247, 242, 255)
    if rounded:
        d.rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 0.22), fill=bg)
    else:
        d.rectangle([0, 0, W, W], fill=bg)
    step = W / 12
    grid = (207, 220, 234, 255)
    for k in range(1, 12):
        d.line([(k * step, 0), (k * step, W)], fill=grid, width=max(1, S))
        d.line([(0, k * step), (W, k * step)], fill=grid, width=max(1, S))
    if rounded:  # clip grid to rounded shape
        mask = Image.new("L", (W, W), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 0.22), fill=255)
        img.putalpha(mask)
        d = ImageDraw.Draw(img)
    pad = W * pad_frac
    inner = W - 2 * pad
    lw = int(inner * 0.105)
    blue, red = (31, 63, 168, 255), (196, 54, 47, 255)
    def stroke(p0, p1, col):
        d.line([p0, p1], fill=col, width=lw)
        r = lw / 2
        for (x, y) in (p0, p1):
            d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    # X on the left half
    x0, x1 = pad + inner * 0.06, pad + inner * 0.46
    y0, y1 = pad + inner * 0.22, pad + inner * 0.78
    stroke((x0, y0), (x1, y1), blue)
    stroke((x1, y0), (x0, y1), blue)
    # 0 on the right half (narrow, like a digit)
    cx, cy = pad + inner * 0.74, pad + inner * 0.5
    rx, ry = inner * 0.17, inner * 0.28
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=red, width=lw)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
icon(512, 0.10, "x02-pwa/icons/icon-512.png")
icon(192, 0.10, "x02-pwa/icons/icon-192.png")
icon(512, 0.20, "x02-pwa/icons/icon-maskable-512.png", rounded=False)
icon(180, 0.12, "x02-pwa/icons/apple-touch-icon.png", rounded=False)
icon(32, 0.04, "x02-pwa/icons/favicon-32.png")
print("icons ok")
