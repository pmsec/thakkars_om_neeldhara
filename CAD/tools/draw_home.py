#!/usr/bin/env python3
"""
A GENERIC PLAN SHEET, for any home that provides the plain contract:

    ENVELOPE   outer polygon
    NEW_WALLS  (x1, y1, x2, y2, thickness, openings, kind, id, note, bow, pts)
               `pts` IS the wall when present; its openings are distances
               along it rather than positions on an axis
               openings being (type, from, to) ABSOLUTE along the wall, and
               bow the wall's sagitta in mm, positive to the LEFT of travel
    SCREENS    (x1, y1, x2, y2, bow, height, id, name, note) — optional
    GLAZING    (x1, y1, x2, y2, kind)
    ROOMS      (name, subtitle, (ax, ay), note, ...)
    FURNITURE  (kind, x1, y1, x2, y2, label[, room, height, poly])
               poly, when given, is the DRAWN OUTLINE and the rect is only
               its bounding box

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
        x1, y1, x2, y2 = self.X(a), self.Y(b), self.X(c), self.Y(d)
        if not dash:
            self.o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" '
                          f'y2="{y2:.1f}" stroke="{col}" stroke-width="{lw}"/>')
            return
        # THE RASTERISER IGNORES stroke-dasharray. Every dashed line on this
        # sheet came out solid until this was found, so a dashed line is drawn
        # as its dashes; the attribute stays on each one so a vector reader
        # still sees the pattern it was asked for.
        on, off = (float(v) for v in str(dash).replace(',', ' ').split()[:2])
        dx, dy = x2 - x1, y2 - y1
        run = math.hypot(dx, dy)
        if run <= 0:
            return
        t = 0.0
        while t < run:
            u = min(t + on, run)
            self.o.append(
                f'<line x1="{x1 + dx * t / run:.1f}" y1="{y1 + dy * t / run:.1f}" '
                f'x2="{x1 + dx * u / run:.1f}" y2="{y1 + dy * u / run:.1f}" '
                f'stroke="{col}" stroke-width="{lw}" stroke-dasharray="{dash}"/>')
            t = u + off

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


def arc_runs(pts, ops):
    """Cumulative distance along a polyline, and the stretches of it that stay
    solid. Openings on an explicit polyline are authored as distances ALONG
    the wall — there is no axis to measure them against."""
    run = [0.0]
    for i in range(1, len(pts)):
        run.append(run[-1] + math.hypot(pts[i][0] - pts[i - 1][0],
                                        pts[i][1] - pts[i - 1][1]))
    return run


def _axis_arc(pts, run, vert, v):
    """Where an opening authored on a wall's axis falls along the wall itself.
    A straight wall makes these the same thing; a bowed one does not — a 1730
    bow over 5245 makes the arc a fifth longer than the chord."""
    key = 1 if vert else 0
    for i in range(1, len(pts)):
        a, b = pts[i - 1][key], pts[i][key]
        if a != b and (a - v) * (b - v) <= 0:
            u = (v - a) / (b - a)
            return run[i - 1] + (run[i] - run[i - 1]) * u
    best, bd = 0.0, None                    # off the end: the nearest vertex
    for i, p in enumerate(pts):
        d = abs(p[key] - v)
        if bd is None or d < bd:
            bd, best = d, run[i]
    return best


def sub_arc(pts, run, d0, d1):
    """The stretch of a polyline between two distances along it.

    THE ENDS ARE INTERPOLATED, not snapped to the nearest vertex. Taking only
    the vertices inside the range is fine on a polyline made of many short
    segments — the kitchen U is 130 of them — but a run drawn as ONE long
    segment has a vertex only at each end, so a stretch that starts part way
    along it came back with a single point and was not drawn at all. That is
    what left the south-east bath's east wall as nothing below its corner.
    """
    out = []
    if d0 > run[0] + 1e-6:
        out.append(_at(pts, run, d0))
    for i, d in enumerate(run):
        if d0 - 1e-6 <= d <= d1 + 1e-6:
            out.append(pts[i])
    if d1 < run[-1] - 1e-6:
        out.append(_at(pts, run, d1))
    clean = []
    for q in out:
        if not clean or math.hypot(q[0] - clean[-1][0], q[1] - clean[-1][1]) > 0.5:
            clean.append(q)
    return clean


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


def _at(pts, run, d):
    """The point d along a polyline."""
    d = min(max(d, 0.0), run[-1])
    i = next((j for j in range(1, len(run)) if run[j] >= d), len(run) - 1)
    a, b = pts[i - 1], pts[i]
    seg = run[i] - run[i - 1] or 1.0
    u = (d - run[i - 1]) / seg
    return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u


def door_swing(sh, pts, run, d0, d1, side=1):
    """A door as the builder draws it: the leaf on its hinge, and its arc.

    IT IS SET OUT ON THE WALL, not on the straight line between the wall's two
    ends. The version before this took the wall's endpoints and its opening
    figures and treated them as coordinates, which is true only of a straight
    wall on an axis. On the kitchen U and on the two curved walls it drew each
    leaf and arc hundreds of millimetres away from its own doorway, out in the
    middle of the living room, and they read as doors nobody had put there.

    `side` is which way the leaf opens: +1 to the right of the wall's own
    direction of travel, -1 to the left. Bathroom doors want the side the
    fixtures are not on.
    """
    d0, d1 = min(d0, d1), max(d0, d1)
    w = d1 - d0
    hx, hy = _at(pts, run, d0)
    tx, ty = _at(pts, run, min(d0 + 60.0, run[-1]))
    tx, ty = tx - hx, ty - hy
    L = math.hypot(tx, ty) or 1.0
    tx, ty = tx / L, ty / L
    nx, ny = ty * side, -tx * side          # the way the leaf swings
    sh.line(hx, hy, hx + nx * w, hy + ny * w, '#8a8378', 1.4)
    n = 12
    arc = []
    for i in range(n + 1):
        a = (i / n) * (math.pi / 2)
        c, sn = math.cos(a), math.sin(a)
        arc.append((hx + w * (nx * c + tx * sn), hy + w * (ny * c + ty * sn)))
    for i in range(n):
        sh.line(arc[i][0], arc[i][1], arc[i + 1][0], arc[i + 1][1], '#c3bcae', 1.0)


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
        poly = f[8] if len(f) > 8 else None
        if f[0] == 'rug':
            # a rug lies under the furniture: a dashed outline, no fill
            a, b, c, d = f[1:5]
            for (x1, y1, x2, y2) in ((a, b, c, b), (c, b, c, d), (c, d, a, d), (a, d, a, b)):
                s.line(x1, y1, x2, y2, '#a89d8a', 1.0, dash='9 7')
            continue
        if f[0] == 'plant':
            cx, cy = (f[1] + f[3]) / 2, (f[2] + f[4]) / 2
            r = min(f[3] - f[1], f[4] - f[2]) / 2
            ring = [(cx + r * math.cos(2 * math.pi * i / 24), cy + r * math.sin(2 * math.pi * i / 24))
                    for i in range(24)]
            s.poly(ring, fill='#dfe8cf', stroke='#7a8a60', sw=1.0)
            continue
        # A GHOST IS A PIECE THAT IS NOT THERE YET — the footprint a Murphy bed
        # takes when it comes down, a door leaf's clearance, a fridge's swing.
        # It is drawn as a dashed outline and nothing else, because it is a
        # note about the room rather than something standing in it.
        if len(f) > 9 and f[9]:
            ring = poly or [(f[1], f[2]), (f[3], f[2]), (f[3], f[4]), (f[1], f[4])]
            for k in range(len(ring)):
                a, b = ring[k], ring[(k + 1) % len(ring)]
                s.line(a[0], a[1], b[0], b[1], '#9a9285', 1.2, dash='16 11')
        elif poly:
            # A piece whose shape matters is drawn by its own outline. The
            # rect in the tuple is only the bounding box the app needs.
            s.poly(poly, fill='#d9c9a8', stroke='#8a7d63', sw=1.2)
        else:
            s.rect(f[1], f[2], f[3], f[4], fill='#ffffff', stroke='#8a8378', sw=1.0)
    s.end_layer()

    s.begin_layer('floor-walls')
    for w in D.NEW_WALLS:
        x1, y1, x2, y2, t = w[:5]
        ops = w[5] if len(w) > 5 else []
        bow = w[9] if len(w) > 9 else 0
        pts_in = w[10] if len(w) > 10 else None
        curve = list(pts_in) if pts_in else bezier(x1, y1, x2, y2, bow)
        if t <= 0:
            s.line(x1, y1, x2, y2, '#b9b2a4', 1.2, dash='10 12')
            continue
        if pts_in:
            run = arc_runs(curve, ops)
            cuts = sorted((min(o[1], o[2]), max(o[1], o[2])) for o in ops
                          if (o[3] if len(o) > 3 else 0) <= 0)
            at, spans = 0.0, []
            for c0, c1 in cuts:
                if c0 > at:
                    spans.append((at, c0))
                at = max(at, c1)
            if at < run[-1]:
                spans.append((at, run[-1]))
            for d0, d1 in spans:
                piece = sub_arc(curve, run, d0, d1)
                if len(piece) >= 2:
                    s.poly(band(piece, t), fill=WALL, stroke='none')
        else:
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
                gl = (sub_arc(curve, arc_runs(curve, ops), f0, f1) if pts_in
                      else along(curve, f0, f1) if bow else (
                    [(x1, f0), (x1, f1)] if abs(x2 - x1) < abs(y2 - y1)
                    else [(f0, y1), (f1, y1)]))
                col = GLAS if kind == 'window' else '#8a8378'
                for k in range(len(gl) - 1):
                    s.line(gl[k][0], gl[k][1], gl[k + 1][0], gl[k + 1][1], col,
                           3.0 if kind == 'window' else 2.0,
                           dash=None if kind == 'window' else '10 8')
                continue
            # Openings on a polyline are already distances along the wall; on
            # any other wall they are authored on its axis, so they are
            # converted before anything is set out.
            dd = arc_runs(curve, ops)
            if pts_in:
                a0, a1 = f0, f1
            else:
                vert = abs(x2 - x1) < abs(y2 - y1)
                a0 = _axis_arc(curve, dd, vert, f0)
                a1 = _axis_arc(curve, dd, vert, f1)
            a0, a1 = min(a0, a1), max(a0, a1)
            if kind == 'door':
                door_swing(s, curve, dd, a0, a1,
                           op[5] if len(op) > 5 else 1)
            elif kind == 'slider':
                # A SLIDER HAS A LEAF BUT NO ARC. The panel is drawn beside the
                # track, in the position it is parked in — which is the only
                # thing a plan can say about a sliding door that a cased
                # opening does not already say.
                lead = sub_arc(curve, dd, a0, a1)
                for k in range(len(lead) - 1):
                    s.line(lead[k][0], lead[k][1], lead[k + 1][0], lead[k + 1][1],
                           '#b0a897', 1.4, dash='7 9')
                side = op[5] if len(op) > 5 else 1
                hx, hy = _at(curve, dd, a0)
                ex, ey = _at(curve, dd, a1)
                tx, ty = ex - hx, ey - hy
                L = math.hypot(tx, ty) or 1.0
                nx, ny = ty / L * side, -tx / L * side
                off = t / 2 + 45.0
                s.line(hx + nx * off, hy + ny * off, ex + nx * off, ey + ny * off,
                       '#8a8378', 2.6)
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
