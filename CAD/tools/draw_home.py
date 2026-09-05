#!/usr/bin/env python3
"""
A GENERIC PLAN SHEET, for any home that provides the plain contract:

    ENVELOPE   outer polygon
    NEW_WALLS  (x1, y1, x2, y2, thickness, openings) centrelines
    GLAZING    (x1, y1, x2, y2, kind)
    ROOMS      (name, subtitle, (ax, ay), note)
    FURNITURE  (kind, a, b, c, d, label)   — may be empty

Om Neeldhara does NOT use this: it has draw_design.py, which knows about its
curved pod screens, its apses and its bespoke joinery, and which must keep
producing byte-identical output. This is for homes that have no such art yet
— which is every home on the day it is imported.

    python3 draw_home.py --home <id>
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

    def __init__(self, x0, y0, x1, y1, width=3000, pad=80):
        self.x0, self.y0 = x0, y0
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


def wall_quad(x1, y1, x2, y2, t):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L * t / 2, dx / L * t / 2
    return [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]


def main():
    # A balcony is a slab outside the enclosure, so it is not in ENVELOPE —
    # but it is part of the drawing, and the sheet has to make room for it.
    extra = list(getattr(D, 'BALCONY', []))
    xs = [p[0] for p in D.ENVELOPE] + [p[0] for p in extra]
    ys = [p[1] for p in D.ENVELOPE] + [p[1] for p in extra]
    m = 1400
    s = Sheet(min(xs) - m, min(ys) - m, max(xs) + m, max(ys) + m)

    s.begin_layer('floor')
    s.poly(D.ENVELOPE, fill=FLOOR, stroke=ENV, sw=2.0)
    if extra:
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
        s.poly(wall_quad(*w[:5]), fill=WALL, stroke='none')
    for g in getattr(D, 'GLAZING', []):
        s.line(g[0], g[1], g[2], g[3], GLAS, 3.0)
    s.end_layer()

    s.begin_layer('labels')
    if extra:
        bx = sum(p[0] for p in extra) / len(extra)
        by = sum(p[1] for p in extra) / len(extra)
        s.text(bx, by - 60, 'BALCONY', 15, TXT, 'bold', 1.1)
        s.text(bx, by + 170, 'outside the enclosure — 3.81 m2 (41 sq ft)', 9, TXT2)
    for name, sub, (ax, ay), note in D.ROOMS:
        s.text(ax, ay - 90, name, 15, TXT, 'bold', 1.1)
        if sub:
            s.text(ax, ay + 80, sub, 10, '#2c5c61', letter=2)
        if note:
            s.text(ax, ay + (230 if sub else 150), note[:46], 9, TXT2)
    s.end_layer()

    s.begin_layer('title')
    meta = home.meta()
    s.text((min(xs) + max(xs)) / 2, min(ys) - 950, meta['name'].upper(), 22, TXT, 'bold', 2)
    s.text((min(xs) + max(xs)) / 2, min(ys) - 660, meta.get('subtitle', ''), 11, TXT2, letter=1)
    s.end_layer()

    s.save('plan')


if __name__ == '__main__':
    main()
