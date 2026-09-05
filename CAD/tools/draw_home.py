#!/usr/bin/env python3
"""
A GENERIC PLAN SHEET, for any home that provides the plain contract:

    ENVELOPE   outer polygon
    NEW_WALLS  (x1, y1, x2, y2, thickness, openings, kind, ...) centrelines,
               openings being (type, from, to) ABSOLUTE along the wall
    GLAZING    (x1, y1, x2, y2, kind)
    ROOMS      (name, subtitle, (ax, ay), note, ...)
    FURNITURE  (kind, a, b, c, d, label)   — may be empty

Om Neeldhara does NOT use this: it has draw_design.py, which knows about its
curved pod screens, its apses and its bespoke joinery, and which must keep
producing byte-identical output. This is for homes that have no such art yet
— which is every home on the day it is imported.

    python3 draw_home.py --home <id>
    python3 draw_home.py --home <id> --room KITCHEN [--pad 2800]
    python3 draw_home.py --home <id> --crop x0,y0,x1,y1 --name round1-kitchen

A CROP is how a change gets reviewed. The full sheet hides flaws; a zoomed
view of just the piece that moved is what catches them. Crops write to
drawings/<name>.png and never touch plan.png.
"""

import math
import os
import sys

import fitz

import home

home.select()
import design as D                                    # noqa: E402
try:
    import immovables as IMM                          # noqa: E402
except ImportError:
    IMM = None

PAPER, WALL, GLAS, TXT, TXT2 = '#f7f5f0', '#2b2825', '#2e8b9a', '#1d1b18', '#6f6a61'
COL, ENV, FLOOR = '#b5342c', '#3b3833', '#efece5'


class Sheet:
    """The same idea as draw_design.py's sheet, kept separate so that file is
    never touched: mm in, SVG out, layers the app can toggle."""

    def __init__(self, x0, y0, x1, y1, width=3000, pad=80, tscale=1.0):
        self.x0, self.y0 = x0, y0
        self.t = tscale
        self.sc = (width - 2 * pad) / (x1 - x0)
        self.w = width
        self.h = int((y1 - y0) * self.sc) + 2 * pad
        self.pad = pad
        # the paper is given real pixel numbers, not "100%": the SVG rasteriser
        # resolves a percentage against a default viewport and paints a pale
        # block in the corner instead of the sheet
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" '
                  f'height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                  f'<rect x="0" y="0" width="{self.w}" height="{self.h}" fill="{PAPER}"/>']

    def X(self, v):
        return self.pad + (v - self.x0) * self.sc

    def Y(self, v):
        return self.pad + (v - self.y0) * self.sc

    def begin_layer(self, i):
        self.o.append(f'<g id="L-{i}">')

    def end_layer(self):
        self.o.append('</g>')

    def poly(self, pts, fill='none', stroke='none', sw=1.0):
        p = ' '.join(f'{self.X(x):.1f},{self.Y(y):.1f}' for x, y in pts)
        self.o.append(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def line(self, a, b, c, d, col, lw=1.0, dash=None):
        ds = f' stroke-dasharray="{dash}"' if dash else ''
        self.o.append(f'<line x1="{self.X(a):.1f}" y1="{self.Y(b):.1f}" x2="{self.X(c):.1f}" '
                      f'y2="{self.Y(d):.1f}" stroke="{col}" stroke-width="{lw}"{ds}/>')

    def rect(self, a, b, c, d, fill='none', stroke='none', sw=1.0):
        self.o.append(f'<rect x="{self.X(a):.1f}" y="{self.Y(b):.1f}" '
                      f'width="{(c - a) * self.sc:.1f}" height="{(d - b) * self.sc:.1f}" '
                      f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def text(self, x, y, s, size=12, col=TXT, weight='normal', letter=0):
        # On a crop the geometry grows and the type would read small against
        # it, so type is scaled with the zoom.
        size *= self.t
        letter *= self.t
        s = (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
        self.o.append(f'<text x="{self.X(x):.1f}" y="{self.Y(y):.1f}" font-family="Helvetica,Arial" '
                      f'font-size="{size}" fill="{col}" font-weight="{weight}" '
                      f'letter-spacing="{letter}" text-anchor="middle">{s}</text>')

    def save(self, name):
        out = home.drawings_dir()
        svg = os.path.join(out, name + '.svg')
        open(svg, 'w').write('\n'.join(self.o) + '</svg>')
        doc = fitz.open(svg)
        doc.load_page(0).get_pixmap(dpi=150).save(os.path.join(out, name + '.png'))
        print('wrote', name, f'({self.w} x {self.h})')


def solid_runs(x1, y1, x2, y2, ops):
    """The wall minus its openings. A gap in the builder's wall lines is a
    door only where his door layer has a leaf in it; everywhere else the wall
    is continuous, so what gets drawn here is the wall he built."""
    vert = abs(x2 - x1) < abs(y2 - y1)
    a0, a1 = (y1, y2) if vert else (x1, x2)
    lo, hi = min(a0, a1), max(a0, a1)
    cuts = sorted((max(lo, min(f0, f1)), min(hi, max(f0, f1))) for _, f0, f1 in ops)
    runs, at = [], lo
    for c0, c1 in cuts:
        if c0 > at:
            runs.append((at, c0))
        at = max(at, c1)
    if at < hi:
        runs.append((at, hi))
    fixed = x1 if vert else y1
    return [(((fixed, p), (fixed, q)) if vert else ((p, fixed), (q, fixed)))
            for p, q in runs]


def door_swing(sh, x1, y1, x2, y2, f0, f1):
    """A door as the builder draws it: the leaf on its hinge, and its arc."""
    vert = abs(x2 - x1) < abs(y2 - y1)
    lo, hi = min(f0, f1), max(f0, f1)
    w = hi - lo
    fixed = x1 if vert else y1
    hx, hy = (fixed, lo) if vert else (lo, fixed)
    lx, ly = (fixed + w, lo) if vert else (lo, fixed + w)
    sh.line(hx, hy, lx, ly, '#8a8378', 1.4)
    n = 12
    pts = []
    for i in range(n + 1):
        a = (i / n) * (math.pi / 2)
        if vert:
            pts.append((fixed + w * math.cos(a), lo + w * math.sin(a)))
        else:
            pts.append((lo + w * math.sin(a), fixed + w * math.cos(a)))
    for i in range(n):
        sh.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#c3bcae', 1.0)


def wall_quad(x1, y1, x2, y2, t):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L * t / 2, dx / L * t / 2
    return [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]


def arg(flag, default=None):
    if flag in sys.argv:
        return sys.argv[sys.argv.index(flag) + 1]
    return default


def crop_box():
    """The window to draw, and the name to write it under. --crop takes mm
    directly; --room takes one or more room names and boxes their anchors."""
    box = arg('--crop')
    if box:
        x0, y0, x1, y1 = (float(v) for v in box.split(','))
        return (x0, y0, x1, y1), arg('--name', 'crop')
    want = arg('--room')
    if not want:
        return None, arg('--name', 'plan')
    keys = [w.strip().upper() for w in want.split(',')]
    pad = float(arg('--pad', 2800))
    hits = []
    for r in D.ROOMS:
        name, sub, (ax, ay) = r[0], r[1], r[2]
        label = f'{name} {sub}'.upper()
        if any(k in label for k in keys):
            hits.append((ax, ay))
    if not hits:
        sys.exit(f'no room matching {want!r}. Have: '
                 + ', '.join(sorted({r[0] for r in D.ROOMS})))
    xs = [p[0] for p in hits]
    ys = [p[1] for p in hits]
    name = arg('--name') or 'crop-' + '-'.join(
        k.lower().replace(' ', '-').replace('/', '') for k in keys)
    return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad), name


def main():
    # A balcony is a slab outside the enclosure, so it is not in ENVELOPE —
    # but it is part of the drawing, and the sheet has to make room for it.
    extra = list(getattr(D, 'BALCONY', []))
    xs = [p[0] for p in D.ENVELOPE] + [p[0] for p in extra]
    ys = [p[1] for p in D.ENVELOPE] + [p[1] for p in extra]
    m = 1400
    full = (min(xs) - m, min(ys) - m, max(xs) + m, max(ys) + m)
    box, out_name = crop_box()
    if box is None:
        s = Sheet(*full)
    else:
        # Clamp to the sheet so a crop can never invent space outside it.
        x0 = max(box[0], full[0]); y0 = max(box[1], full[1])
        x1 = min(box[2], full[2]); y1 = min(box[3], full[3])
        zoom = (full[2] - full[0]) / max(1.0, x1 - x0)
        s = Sheet(x0, y0, x1, y1, tscale=min(3.0, max(1.0, zoom ** 0.6)))

    s.begin_layer('floor')
    # The external walls are the band between the envelope and the floor
    # plate. Drawing them as a band rather than an outline is what makes the
    # sheet read as a plan instead of a diagram.
    plate = getattr(D, 'PLATE', None) or getattr(D, 'CARPET', None)
    s.poly(D.ENVELOPE, fill=(WALL if plate else FLOOR), stroke=ENV, sw=2.0)
    if plate:
        s.poly(plate, fill=FLOOR, stroke='none')
    if extra and not plate:
        s.poly(extra, fill='#e8eef0', stroke=ENV, sw=1.4)
    s.end_layer()

    s.begin_layer('ref')
    if IMM is not None:
        for n, a, b, c, d, k in getattr(IMM, 'NAMED', []):
            s.rect(a, b, c, d, fill=COL, stroke='#7c1610', sw=0.8)
    s.end_layer()

    s.begin_layer('furniture')
    for f in getattr(D, 'FURNITURE', []):
        s.rect(f[1], f[2], f[3], f[4], fill='#ffffff', stroke='#8a8378', sw=1.0)
    s.end_layer()

    s.begin_layer('floor-walls')
    for w in D.NEW_WALLS:
        x1, y1, x2, y2, t = w[:5]
        ops = w[5] if len(w) > 5 else []
        if t <= 0:
            # A threshold is an opening, not a wall: a broken line, so the
            # plan reads as the open room it is.
            s.line(x1, y1, x2, y2, '#b9b2a4', 1.2, dash='10 12')
            continue
        for a, b in solid_runs(x1, y1, x2, y2, ops):
            s.poly(wall_quad(a[0], a[1], b[0], b[1], t), fill=WALL, stroke='none')
        for kind, f0, f1 in ops:
            door_swing(s, x1, y1, x2, y2, f0, f1)
    for g in getattr(D, 'GLAZING', []):
        s.line(g[0], g[1], g[2], g[3], GLAS, 3.0)
    s.end_layer()

    s.begin_layer('labels')
    for r in D.ROOMS:
        name, sub, (ax, ay), note = r[:4]
        size = r[4] if len(r) > 4 else ''
        s.text(ax, ay - 90, name, 15, TXT, 'bold', 1.1)
        if sub:
            s.text(ax, ay + 80, sub, 10, '#2c5c61', letter=2)
        if size:
            s.text(ax, ay + (230 if sub else 150), size, 11, TXT2)
        if note:
            s.text(ax, ay + (390 if sub else 310), note[:70], 9, TXT2)
    s.end_layer()

    s.begin_layer('title')
    meta = home.meta()
    if box is None:
        s.text((min(xs) + max(xs)) / 2, min(ys) - 950, meta['name'].upper(), 22, TXT, 'bold', 2)
        s.text((min(xs) + max(xs)) / 2, min(ys) - 660, meta.get('subtitle', ''), 11, TXT2, letter=1)
    s.end_layer()

    s.save(out_name)


if __name__ == '__main__':
    main()
