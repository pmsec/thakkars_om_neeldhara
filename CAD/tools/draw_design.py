"""
Round 1 review drawing: the corrected layout on the builder's shell.

    python3 tools/draw_design.py

Writes drawings/07-round1-layout.png/.svg
"""

import math
import os
import sys

import fitz
import numpy as np

import clash as C
import design as D
import frame
import retrofit as R

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'drawings')

INK = '#1b1a18'
PAPER = '#faf8f4'
SLAB = '#eceae4'
KEEP = '#c8332b'
NEWW = '#1b1a18'
GLAS = '#2f6f86'
FURN = '#9a9184'
TXT = '#2a2724'
TXT2 = '#7d7568'
DIMC = '#6f6a60'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def bez(P, t):
    u = 1 - t
    return (u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0],
            u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1])


def bez_x(P, y):
    lo, hi = 0.0, 1.0
    for _ in range(50):
        m = (lo + hi) / 2
        if bez(P, m)[1] < y:
            lo = m
        else:
            hi = m
    return bez(P, (lo + hi) / 2)[0]


class Sheet:
    def __init__(self, x0, y0, x1, y1, width=4200, pad=90):
        self.x0, self.y0 = x0, y0
        self.sc = (width - 2 * pad) / (x1 - x0)
        self.w = width
        self.h = int((y1 - y0) * self.sc) + 2 * pad
        self.pad = pad
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" '
                  f'height="{self.h}"><rect width="100%" height="100%" fill="{PAPER}"/>']

    def X(self, v):
        return self.pad + (v - self.x0) * self.sc

    def Y(self, v):
        return self.pad + (v - self.y0) * self.sc

    def rect(self, a, b, c, d, **kw):
        st = ' '.join(f'{k.replace("_", "-")}="{v}"' for k, v in kw.items())
        self.o.append(f'<rect x="{self.X(a):.1f}" y="{self.Y(b):.1f}" '
                      f'width="{(c - a) * self.sc:.1f}" height="{(d - b) * self.sc:.1f}" {st}/>')

    def line(self, a, b, c, d, col, lw=1.0, dash=None):
        ds = f' stroke-dasharray="{dash}"' if dash else ''
        self.o.append(f'<line x1="{self.X(a):.1f}" y1="{self.Y(b):.1f}" '
                      f'x2="{self.X(c):.1f}" y2="{self.Y(d):.1f}" stroke="{col}" '
                      f'stroke-width="{lw}"{ds}/>')

    def poly(self, pts, **kw):
        st = ' '.join(f'{k.replace("_", "-")}="{v}"' for k, v in kw.items())
        p = ' '.join(f'{self.X(a):.1f},{self.Y(b):.1f}' for a, b in pts)
        self.o.append(f'<polygon points="{p}" {st}/>')

    def path(self, pts, col, lw, dash=None, fill='none'):
        d = 'M ' + ' L '.join(f'{self.X(a):.1f},{self.Y(b):.1f}' for a, b in pts)
        ds = f' stroke-dasharray="{dash}"' if dash else ''
        self.o.append(f'<path d="{d}" stroke="{col}" stroke-width="{lw}" '
                      f'fill="{fill}"{ds} stroke-linecap="round"/>')

    def text(self, x, y, s, size=13, col=TXT, anchor='middle', weight='normal',
             letter=0):
        ls = f' letter-spacing="{letter}"' if letter else ''
        self.o.append(f'<text x="{self.X(x):.1f}" y="{self.Y(y):.1f}" font-size="{size}" '
                      f'fill="{col}" text-anchor="{anchor}" font-weight="{weight}" '
                      f'font-family="Helvetica,Arial,sans-serif"{ls}>{esc(s)}</text>')

    def save(self, name):
        self.o.append('</svg>')
        svg = os.path.join(OUT, name + '.svg')
        open(svg, 'w').write('\n'.join(self.o))
        fitz.open(svg)[0].get_pixmap(matrix=fitz.Matrix(1.15, 1.15)).save(
            os.path.join(OUT, name + '.png'))
        print('wrote', name)


def wall_quads(x1, y1, x2, y2, t, ops):
    L = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    px, py = -uy, ux
    cuts = [0.0]
    for a, b in sorted(ops):
        cuts += [max(0.0, a), min(L, b)]
    cuts.append(L)
    out = []
    h = t / 2
    for i in range(0, len(cuts) - 1, 2):
        a, b = cuts[i], cuts[i + 1]
        if b - a <= 1:
            continue
        ax_, ay_ = x1 + ux * a, y1 + uy * a
        bx_, by_ = x1 + ux * b, y1 + uy * b
        out.append([(ax_ + px * h, ay_ + py * h), (bx_ + px * h, by_ + py * h),
                    (bx_ - px * h, by_ - py * h), (ax_ - px * h, ay_ - py * h)])
    return out


def arc_quads(cx, cy, r, t, gaps, step=1.5):
    segs, cur = [], []
    for a in np.arange(0, 360, step):
        if any((g0 % 360) <= (a % 360) <= (g1 % 360) if g0 % 360 <= g1 % 360
               else (a % 360) >= (g0 % 360) or (a % 360) <= (g1 % 360)
               for g0, g1 in gaps):
            if cur:
                segs.append(cur)
                cur = []
            continue
        cur.append(math.radians(a))
    if cur:
        segs.append(cur)
    out = []
    for s in segs:
        inner = [(cx + math.cos(a) * (r - t / 2), cy + math.sin(a) * (r - t / 2)) for a in s]
        outer = [(cx + math.cos(a) * (r + t / 2), cy + math.sin(a) * (r + t / 2))
                 for a in reversed(s)]
        out.append(inner + outer)
    return out


def main():
    lay = C.builder_layers()
    bl = max(lay['DA_BUILDING LINE'], key=len)
    cols = C.rects(lay['DA_COLUMN']) + C.beam_rects()

    s = Sheet(-3200, -2400, 26600, 12600)

    # ---------------------------------------------------------------- slab
    s.poly(bl, fill=SLAB, stroke='#b9b5ab', stroke_width=1.4)

    # ------------------------------------------------- builder walls kept/out
    keep, demo = R.keep_demo()
    for x1, y1, x2, y2 in demo:
        s.line(x1, y1, x2, y2, '#c4bdb1', 1.1, dash='7 6')

    # -------------------------------------------------- keep-clear zones
    for name, a, b, c, d, kind in C.NAMED:
        s.rect(a, b, c, d, fill='#ffffff', stroke=KEEP, stroke_width=2.2,
               stroke_dasharray='9 6')
        for k in range(0, int(c - a) + int(d - b), 260):
            x1_, y1_ = a + k, b
            x2_, y2_ = a, b + k
            s.o.append(f'<line x1="{s.X(max(a, min(c, x1_))):.1f}" '
                       f'y1="{s.Y(b + max(0, x1_ - c)):.1f}" '
                       f'x2="{s.X(a + max(0, y2_ - d)):.1f}" '
                       f'y2="{s.Y(max(b, min(d, y2_))):.1f}" stroke="{KEEP}" '
                       f'stroke-width="0.7" opacity="0.45"/>')
        lab = name.split(',')[0].upper()
        s.text((a + c) / 2, b - 110, f'{lab}  {c - a:.0f}×{d - b:.0f}', 12, KEEP,
               weight='bold')

    # kept builder walls sit on top of everything structural
    for x1, y1, x2, y2 in keep:
        s.line(x1, y1, x2, y2, '#3b3833', 3.4)

    # ---------------------------------------------------------- pod glazing
    for P in (D.POD_W, D.POD_E):
        ts = np.linspace(0, 1, 220)
        pts = [bez(P, t) for t in ts]
        a, b = D.POD_PORTAL
        s.path([p for p, t in zip(pts, ts) if t < a], GLAS, 5.0)
        s.path([p for p, t in zip(pts, ts) if t > b], GLAS, 5.0)
        s.path([p for p, t in zip(pts, ts) if a <= t <= b], GLAS, 1.6, dash='9 7')

    for x1, y1, x2, y2, kind in D.GLAZING:
        s.line(x1, y1, x2, y2, GLAS, 4.0 if kind == 'slider' else 3.0)

    # ---------------------------------------------------------- new walls
    for x1, y1, x2, y2, t, ops in D.NEW_WALLS:
        for q in wall_quads(x1, y1, x2, y2, t, ops):
            s.poly(q, fill=NEWW, stroke='none')
    cx, cy, r, t, gaps = D.GALLERY
    for q in arc_quads(cx, cy, r, t, gaps):
        s.poly(q, fill=NEWW, stroke='none')

    # -------------------------------------------------------- new openings
    for x1, y1, x2, y2, lab in D.CUT_OPENINGS:
        s.rect(x1, y1, x2, y2, fill='none', stroke='#c07a1e', stroke_width=1.8,
               stroke_dasharray='7 5')

    # ---------------------------------------------------------- furniture
    for kind, a, b, c, d, lab in D.FURNITURE:
        if kind == 'grass':
            s.rect(a, b, c, d, fill='#cdd9c2', stroke='#9db08c', stroke_width=1.0)
        elif kind == 'spa':
            s.rect(a, b, c, d, fill='#dbeaef', stroke='#8ab0bd', stroke_width=1.2, rx=90)
        elif kind in ('shower',):
            s.rect(a, b, c, d, fill='#e9f1f3', stroke=FURN, stroke_width=1.0)
            s.line(a, b, c, d, FURN, 0.8)
            s.line(c, b, a, d, FURN, 0.8)
        elif kind == 'wc':
            s.rect(a, b, c, d, fill='#ffffff', stroke=FURN, stroke_width=1.0, rx=70)
        elif kind in ('counter', 'joinery', 'appliance'):
            s.rect(a, b, c, d, fill='#efe9dd', stroke=FURN, stroke_width=1.1)
        elif kind in ('bed', 'bed-w'):
            s.rect(a, b, c, d, fill='#ffffff', stroke=FURN, stroke_width=1.1, rx=50)
            if kind == 'bed':
                s.rect(a, b, c, b + 200, fill='#efe9dd', stroke=FURN, stroke_width=0.8)
            else:
                s.rect(a, b, a + 200, d, fill='#efe9dd', stroke=FURN, stroke_width=0.8)
        elif kind == 'sofa':
            s.rect(a, b, c, d, fill='#ffffff', stroke=FURN, stroke_width=1.1, rx=60)
        elif kind == 'table':
            rr = min(c - a, d - b) / 2
            s.o.append(f'<circle cx="{s.X((a + c) / 2):.1f}" cy="{s.Y((b + d) / 2):.1f}" '
                       f'r="{rr * s.sc:.1f}" fill="#f3ede0" stroke="{FURN}" stroke-width="1.1"/>')
            if 'dining' in lab:
                for k in range(6):
                    ang = math.radians(k * 60)
                    ccx = (a + c) / 2 + math.cos(ang) * (rr + 430)
                    ccy = (b + d) / 2 + math.sin(ang) * (rr + 430)
                    s.rect(ccx - 230, ccy - 230, ccx + 230, ccy + 230, fill='#ffffff',
                           stroke=FURN, stroke_width=1.0, rx=50)

    # ---------------------------------------------------- columns and beams
    for r_ in cols:
        s.rect(*r_, fill=KEEP, stroke='#7c1610', stroke_width=1.0)

    # --------------------------------------------------------------- labels
    def area_of(rects):
        return sum((c - a) * (d - b) for a, b, c, d in rects) / 1e6

    for name, sub, rects, note in D.ROOMS:
        if not rects:
            continue
        big = max(rects, key=lambda r_: (r_[2] - r_[0]) * (r_[3] - r_[1]))
        cx_ = (big[0] + big[2]) / 2
        cy_ = (big[1] + big[3]) / 2
        A = area_of(rects)
        s.text(cx_, cy_ - 150, name, 22 if A > 8 else 16, TXT, weight='bold', letter=1.4)
        if sub:
            s.text(cx_, cy_ + 90, sub, 14, '#2c5c61', letter=2.5)
        s.text(cx_, cy_ + (230 if sub else 130),
               f'{A:.1f} m²  ·  {A * 10.7639:.0f} sq ft', 13, TXT2)
        if note:
            s.text(cx_, cy_ + (400 if sub else 300), note, 11, TXT2)

    # pods + great room, measured off the curves
    fam_p, den_p, great_p = R.pod_polys()

    def parea(p):
        return abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
                       for i in range(len(p)))) / 2e6
    pod, great = parea(fam_p), parea(great_p)
    for cx_, nm in ((6550, 'FAMILY ROOM'), (D.M(6550), 'MUSIC + WORK DEN')):
        s.text(cx_, 6250, nm, 19, TXT, weight='bold', letter=1.4)
        s.text(cx_, 6500, f'{pod:.1f} m²  ·  {pod * 10.7639:.0f} sq ft', 13, TXT2)
        s.text(cx_, 6730, 'one pod  ·  glass roof over the 3665 × 2280 bay', 11, TXT2)
    s.text(D.MID, 3450, 'G R E A T   R O O M', 30, TXT, weight='bold')
    s.text(D.MID, 3780, f'{great:.1f} m²  ·  {great * 10.7639:.0f} sq ft  ·  '
                        f'party wall removed, 7840 across', 14, TXT2)

    # ----------------------------------------------------------- dimensions
    for x1, y1, x2, y2, txt in D.DIMS:
        s.line(x1, y1, x2, y2, DIMC, 0.9)
        for px_, py_ in ((x1, y1), (x2, y2)):
            if y1 == y2:
                s.line(px_, py_ - 90, px_, py_ + 90, DIMC, 0.9)
            else:
                s.line(px_ - 90, py_, px_ + 90, py_, DIMC, 0.9)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if y1 == y2:
            s.rect(mx - len(txt) * 42, my - 130, mx + len(txt) * 42, my + 110,
                   fill=PAPER, stroke='none')
            s.text(mx, my + 45, txt, 12, DIMC)
        else:
            s.o.append(f'<g transform="translate({s.X(mx):.1f},{s.Y(my):.1f}) rotate(-90)">'
                       f'<rect x="{-len(txt) * 3.5}" y="-9" width="{len(txt) * 7}" '
                       f'height="18" fill="{PAPER}"/>'
                       f'<text x="0" y="4" font-size="12" fill="{DIMC}" '
                       f'text-anchor="middle" font-family="Helvetica,Arial,sans-serif">'
                       f'{esc(txt)}</text></g>')

    # ---------------------------------------------------------------- title
    s.text(-3000, -2050, 'FULL-FLOOR RESIDENCE  —  ROUND 1', 30, INK, anchor='start',
           weight='bold')
    s.text(-3000, -1780, 'A-101 SET OUT ON THE BUILDER SHELL  ·  ALL COLUMNS, BEAMS, '
                         'SHAFTS, DUCTS AND VOIDS HONOURED', 14, TXT2, anchor='start')
    s.text(-3000, -1560, 'DIMENSIONS IN MILLIMETRES  ·  CONCEPT DRAWING, NOT FOR '
                         'CONSTRUCTION', 12, '#9a9184', anchor='start')

    lx, ly = -3000, 11500
    for i, (col, txt) in enumerate([
            (SLAB, 'builder slab'),
            (KEEP, 'builder column / beam, and keep-clear shaft, duct or void'),
            (NEWW, 'new masonry'),
            (GLAS, 'glazing / sliding glass'),
            ('#c07a1e', 'new opening cut in existing masonry')]):
        s.o.append(f'<rect x="{s.X(lx):.1f}" y="{s.Y(ly) + i * 26 - 13:.0f}" width="34" '
                   f'height="17" fill="{col}" stroke="#888" stroke-width="0.6"/>')
        s.o.append(f'<text x="{s.X(lx) + 46:.1f}" y="{s.Y(ly) + i * 26:.0f}" '
                   f'font-size="15" fill="{TXT}" '
                   f'font-family="Helvetica,Arial,sans-serif">{esc(txt)}</text>')

    s.save('07-round1-layout')


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
