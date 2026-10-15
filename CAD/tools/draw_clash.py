"""
Clash map: what the plan draws, against what the builder actually built.

    python3 tools/draw_clash.py

Pale grey  = builder slab (interior of layer DA_BUILDING LINE)
White gaps inside it = shafts, ducts and voids - no floor
Red        = plan floor drawn where there is no slab
Solid red  = builder columns and beams
Blue       = the plan's own walls
"""

import os
import sys

import fitz
import numpy as np

import clash as C
import frame
import plan_model as PM

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'drawings')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main():
    lay = C.builder_layers()
    bl = max(lay['DA_BUILDING LINE'], key=len)
    slab = C.blank()
    C.put_poly(slab, bl)
    cols = C.rects(lay['DA_COLUMN']) + C.beam_rects()
    plan_floor, plan_wall = C.plan_masks()
    off = (plan_floor | plan_wall) & ~slab

    x0, y0, x1, y1 = -1400, -1400, 25900, 13400
    W, pad = 3600, 70
    sc = (W - 2 * pad) / (x1 - x0)
    H = int((y1 - y0) * sc) + 2 * pad + 150
    X = lambda v: pad + (v - x0) * sc
    Y = lambda v: pad + (v - y0) * sc

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">'
         f'<rect width="100%" height="100%" fill="#ffffff"/>',
         ]

    for g in range(-1000, 26000, 1000):
        maj = g % 5000 == 0
        o.append(f'<line x1="{X(g):.1f}" y1="0" x2="{X(g):.1f}" y2="{H - 150}" '
                 f'stroke="{"#c8dcea" if maj else "#f0f0f0"}" stroke-width="0.6"/>')
        if maj:
            o.append(f'<text x="{X(g) + 3:.1f}" y="16" font-size="13" fill="#5a9">{g}</text>')
    for g in range(-1000, 13500, 1000):
        maj = g % 5000 == 0
        o.append(f'<line x1="0" y1="{Y(g):.1f}" x2="{W}" y2="{Y(g):.1f}" '
                 f'stroke="{"#c8dcea" if maj else "#f0f0f0"}" stroke-width="0.6"/>')
        if maj:
            o.append(f'<text x="4" y="{Y(g) - 4:.1f}" font-size="13" fill="#5a9">{g}</text>')

    # builder slab, as one filled polygon
    pts = ' '.join(f'{X(a):.1f},{Y(b):.1f}' for a, b in bl)
    o.append(f'<polygon points="{pts}" fill="#e3e6e2" stroke="#8d938a" stroke-width="2"/>')

    # plan rooms, outlined
    for name, a, b, w, h in PM.FLOORS:
        o.append(f'<rect x="{X(a):.1f}" y="{Y(b):.1f}" width="{w * sc:.1f}" '
                 f'height="{h * sc:.1f}" fill="none" stroke="#3a6ea5" '
                 f'stroke-width="1.1" stroke-dasharray="5 4"/>')
    g = PM.GALLERY
    o.append(f'<circle cx="{X(g[0]):.1f}" cy="{Y(g[1]):.1f}" r="{g[2] * sc:.1f}" '
             f'fill="none" stroke="#3a6ea5" stroke-width="1.1" stroke-dasharray="5 4"/>')

    # masks are emitted as run-length rows, not one rect per cell
    def paint(mask, fill, op=1.0):
        for j in range(C.NY):
            row = mask[j]
            if not row.any():
                continue
            i = 0
            while i < C.NX:
                if row[i]:
                    k = i
                    while k < C.NX and row[k]:
                        k += 1
                    o.append(
                        f'<rect x="{X(C.XS[i] - C.CELL / 2):.1f}" '
                        f'y="{Y(C.YS[j] - C.CELL / 2):.1f}" '
                        f'width="{(C.XS[k - 1] - C.XS[i] + C.CELL) * sc:.1f}" '
                        f'height="{C.CELL * sc + 0.4:.1f}" fill="{fill}" '
                        f'fill-opacity="{op}"/>')
                    i = k
                else:
                    i += 1

    paint(plan_wall, '#22406a')
    paint(off, '#d81b1b', 0.55)

    # columns / beams
    for r in cols:
        o.append(f'<rect x="{X(r[0]):.1f}" y="{Y(r[1]):.1f}" '
                 f'width="{(r[2] - r[0]) * sc:.1f}" height="{(r[3] - r[1]) * sc:.1f}" '
                 f'fill="#d81b1b" stroke="#7a0000" stroke-width="1.2"/>')

    # the lift lobby, annexed but not a structural clash
    n, a, b, c, d = C.COMMON
    o.append(f'<rect x="{X(a):.1f}" y="{Y(b):.1f}" width="{(c - a) * sc:.1f}" '
             f'height="{(d - b) * sc:.1f}" fill="#f0a500" fill-opacity="0.18" '
             f'stroke="#c98800" stroke-width="2" stroke-dasharray="10 6"/>')

    for nm, a, b, c, d, kind in C.NAMED:
        o.append(f'<text x="{X((a + c) / 2):.1f}" y="{Y(b) - 8:.1f}" font-size="14" '
                 f'font-weight="bold" fill="#7a0000" text-anchor="middle">'
                 f'{esc(nm.split(",")[0])}  {c - a:.0f}x{d - b:.0f}</text>')
    o.append(f'<text x="{X(12240):.1f}" y="{Y(12905) + 26:.1f}" font-size="15" '
             f'font-weight="bold" fill="#8a5c00" text-anchor="middle">'
             f'LIFT LOBBY + FIRE-LIFT LANDING - common property, 8.9 m2 enclosed</text>')

    ly = H - 108
    for i, (col, txt) in enumerate([
            ('#e3e6e2', 'builder slab (DA_BUILDING LINE); white gaps in it = shafts, ducts, voids'),
            ('#d81b1b', 'builder column or beam - A-101 shows none of these'),
            ('#22406a', 'plan A-101 walls'),
            ('#e98a8a', 'PLAN FLOOR WITH NO SLAB UNDER IT - 14.9 m2 (160 sq ft)')]):
        o.append(f'<rect x="{pad}" y="{ly + i * 26 - 13:.0f}" width="34" height="17" '
                 f'fill="{col}" stroke="#666" stroke-width="0.8"/>')
        o.append(f'<text x="{pad + 46}" y="{ly + i * 26:.0f}" font-size="16" fill="#222">'
                 f'{esc(txt)}</text>')
    o.append('</svg>')

    svg = os.path.join(OUT, '06-clash-map.svg')
    open(svg, 'w').write('\n'.join(o))
    fitz.open(svg)[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(
        os.path.join(OUT, '06-clash-map.png'))
    print('wrote 06-clash-map')


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
