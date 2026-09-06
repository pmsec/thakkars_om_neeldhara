#!/usr/bin/env python3
"""
A GENERIC PLAN SHEET, for any home that provides the plain contract:

    ENVELOPE   outer polygon
    NEW_WALLS  (x1, y1, x2, y2, thickness, openings, kind, id, note, bow)
               openings being (type, from, to) ABSOLUTE along the wall, and
               bow the wall's sagitta in mm, positive to the LEFT of travel
    SCREENS    (x1, y1, x2, y2, bow, height, id, name, note) — optional
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
        # :g so an unzoomed sheet still writes font-size="15", not "15.0" —
        # the crop feature must not churn the full sheet's bytes.
        self.o.append(f'<text x="{self.X(x):.1f}" y="{self.Y(y):.1f}" font-family="Helvetica,Arial" '
                      f'font-size="{size:g}" fill="{col}" font-weight="{weight}" '
                      f'letter-spacing="{letter:g}" text-anchor="middle">{s}</text>')

    def save(self, name):
        out = home.drawings_dir()
        svg = os.path.join(out, name + '.svg')
        open(svg, 'w').write('\n'.join(self.o) + '</svg>')
        doc = fitz.open(svg)
        doc.load_page(0).get_pixmap(dpi=150).save(os.path.join(out, name + '.png'))
        print('wrote', name, f'({self.w} x {self.h})')


def bezier(x1, y1, x2, y2, bow, n=48):
    """A bowed wall as a quadratic Bezier, flattened. `bow` is the sagitta —
    the distance from the middle of the wall to the straight line between its
    ends — so the control point is offset by twice it. Positive is to the LEFT
    of the direction of travel."""
    if not bow:
        return [(x1, y1), (x2, y2)]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L, dx / L
    cx = (x1 + x2) / 2 + nx * 2 * bow
    cy = (y1 + y2) / 2 + ny * 2 * bow
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u * u * x1 + 2 * u * t * cx + t * t * x2,
                    u * u * y1 + 2 * u * t * cy + t * t * y2))
    return out


def band(pts, t):
    """A polyline given thickness: offset both ways and close the ring. Good
    enough for a plan at these radii — the walls are 125 thick and the bows are
    hundreds of millimetres, so the offset never folds on itself."""
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L * t / 2, dx / L * t / 2
        left.append((x + nx, y + ny))
        right.append((x - nx, y - ny))
    return left + right[::-1]


def along(pts, f0, f1):
    """The stretch of a polyline between two ABSOLUTE positions measured along
    the wall's own axis — how openings are authored, so that a bowed wall's
    door sits where it would on the straight line."""
    vert = abs(pts[-1][0] - pts[0][0]) < abs(pts[-1][1] - pts[0][1])
    lo, hi = min(f0, f1), max(f0, f1)
    return [p for p in pts if lo - 1e-6 <= (p[1] if vert else p[0]) <= hi + 1e-6]


def solid_runs(x1, y1, x2, y2, ops):
    """The wall minus the openings that reach the floor.

    ONLY A SILL OF ZERO CUTS THE WALL. A window, or glass over a counter, or
    a serving hatch at worktop height, leaves the wall standing underneath it
    — in plan you are looking at the base, and the base is solid. Cutting for
    those drew a counter wall as two stubs and a line.
    """
    vert = abs(x2 - x1) < abs(y2 - y1)
    a0, a1 = (y1, y2) if vert else (x1, x2)
    lo, hi = min(a0, a1), max(a0, a1)
    cuts = sorted((max(lo, min(o[1], o[2])), min(hi, max(o[1], o[2])))
                  for o in ops if (o[3] if len(o) > 3 else 0) <= 0)
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
        bow = w[9] if len(w) > 9 else 0
        curve = bezier(x1, y1, x2, y2, bow)
        if t <= 0:
            s.line(x1, y1, x2, y2, '#b9b2a4', 1.2, dash='10 12')
            continue
        for a, b in solid_runs(x1, y1, x2, y2, ops):
            piece = along(curve, (a[1] if a[0] == b[0] else a[0]),
                          (b[1] if a[0] == b[0] else b[0])) if bow else [a, b]
            if len(piece) >= 2:
                s.poly(band(piece, t), fill=WALL, stroke='none')
        for op in ops:
            kind, f0, f1 = op[:3]
            sill = op[3] if len(op) > 3 else 0
            if sill > 0:
                # Glass, or a hatch, above a solid base: drawn as glazing on
                # the line it actually follows, not as a hole in the wall.
                gl = along(curve, f0, f1) if bow else (
                    [(x1, f0), (x1, f1)] if abs(x2 - x1) < abs(y2 - y1)
                    else [(f0, y1), (f1, y1)])
                col = GLAS if kind == 'window' else '#8a8378'
                for k in range(len(gl) - 1):
                    s.line(gl[k][0], gl[k][1], gl[k + 1][0], gl[k + 1][1], col,
                           3.0 if kind == 'window' else 2.0,
                           dash=None if kind == 'window' else '10 8')
                continue
            if kind == 'door':
                door_swing(s, x1, y1, x2, y2, f0, f1)
            else:
                # An arched or cased opening has no leaf. Drawn as the line of
                # the reveal plus, for an arch, the head projected down into
                # plan — the way an arch is shown on a sheet, so the drawing
                # says which openings are arched and which are just holes.
                jamb = along(curve, f0, f1) if bow else None
                pa, pb = (jamb[0], jamb[-1]) if jamb else (
                    ((x1, f0), (x1, f1)) if abs(x2 - x1) < abs(y2 - y1) else ((f0, y1), (f1, y1)))
                s.line(pa[0], pa[1], pb[0], pb[1], '#b0a897', 1.4, dash='7 9')
                if kind == 'arch':
                    w = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
                    arc = bezier(pa[0], pa[1], pb[0], pb[1],
                                 (w / 5) * (1 if bow >= 0 else -1), 16)
                    for k in range(len(arc) - 1):
                        s.line(arc[k][0], arc[k][1], arc[k + 1][0], arc[k + 1][1],
                               '#b0a897', 1.0, dash='7 9')
    for sc in getattr(D, 'SCREENS', []):
        x1, y1, x2, y2, bow, h = sc[:6]
        # A screen is drawn thinner and softer than a wall, because it is not
        # one: it stops below the ceiling and divides nothing the model counts.
        s.poly(band(bezier(x1, y1, x2, y2, bow), 90), fill='#6f6a61', stroke='none')
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
