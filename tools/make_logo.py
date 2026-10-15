# Builds the RiverSynth logo (SVG) and its PNG variants. Run from the repo root.
import math
from PIL import Image, ImageDraw, ImageFont

LIT = [5, 3, 2, 3, 5, 7, 8, 7, 5, 3]  # row of the bright "river" dot in each column (0 = top)
STEP, FIRST, R_DOT, R_CLIP = 14, 17, 4.6, 68  # grid centred on (80, 80)

def dots():
    for c in range(10):
        for r in range(10):
            x, y = FIRST + c * STEP, FIRST + r * STEP
            if math.hypot(x - 80, y - 80) > R_CLIP:
                continue
            yield x, y, '#5b9cf0' if r == LIT[c] else ('#1f4677' if r > LIT[c] else '#2e2e2e')

svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">',
       '  <title>RiverSynth</title>', '  <circle cx="80" cy="80" r="78" fill="#161616"/>']
svg += [f'  <circle cx="{x}" cy="{y}" r="{R_DOT}" fill="{f}"/>' for x, y, f in dots()]
svg.append('</svg>\n')
open('assets/logo.svg', 'w').write('\n'.join(svg))

def draw_logo(img, ox, oy, s):
    d = ImageDraw.Draw(img)
    d.ellipse([ox + 2 * s, oy + 2 * s, ox + 158 * s, oy + 158 * s], fill='#161616')
    for x, y, f in dots():
        d.ellipse([ox + (x - R_DOT) * s, oy + (y - R_DOT) * s, ox + (x + R_DOT) * s, oy + (y + R_DOT) * s], fill=f)

icon = Image.new('RGB', (180, 180), '#efe8d8')
draw_logo(icon, 10, 10, 1.0)
icon.save('assets/apple-touch-icon.png')

def font(size, bold=False):
    try:
        return ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', size, index=1 if bold else 0)
    except Exception:
        return ImageFont.load_default()

og = Image.new('RGB', (1200, 630), '#efe8d8')
draw_logo(og, 90, 123, 2.4)
d = ImageDraw.Draw(og)
x0 = 540
title = font(80, True)
d.text((x0, 205), 'riversynth', fill='#161616', font=title)
w = d.textlength('riversynth', font=title)
d.ellipse([x0 + w + 14, 262, x0 + w + 36, 284], fill='#2c63a8')
d.text((x0 + 2, 320), 'turn river flow into music', fill='#3a3530', font=font(32))
d.text((x0 + 2, 372), 'a synth that plays USGS stream gauges', fill='#6c6357', font=font(22))
for a, b, c in [(0, 78, '#2c63a8'), (90, 128, '#f0b62f'), (140, 168, '#d0402c'), (180, 198, '#3f8f5a')]:
    d.rectangle([x0 + 2 + a, 450, x0 + 2 + b, 458], fill=c)
og.save('assets/og-image.png')
print('ok')
