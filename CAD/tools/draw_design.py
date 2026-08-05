"""
Round 1 review drawing: the corrected layout on the builder's shell.

    python3 tools/draw_design.py

Writes drawings/07-round1-layout.png/.svg
"""

import math
import os
import sys

ISLAND = "--island" in sys.argv

import fitz
import numpy as np

import clash as C
import design as D
import frame
import retrofit as R
import symbols as SY

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
WOOD = '#8a6440'
WOODL = '#cbab80'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


bez, bez_x = R.bez, R.bez_x     # one implementation, shared


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

    def begin_layer(self, id_):
        """Open a named <g> so the portal can toggle this stretch of the
        sheet as a layer. Draw order — and so z-order — is unchanged."""
        self.o.append(f'<g id="L-{id_}">')

    def end_layer(self):
        self.o.append('</g>')

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
    a0 = gaps[0][0]                         # start inside a gap, so no run is
    for a in np.arange(a0, a0 + 360, step):  # cut in half at the seam
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

    s = Sheet(-3200, -2400, 26600, 16100)

    # ---------------------------------------------------------------- slab
    s.poly(bl, fill=SLAB, stroke='#b9b5ab', stroke_width=1.4)

    # ------------------------------------------------------- keep only: shell
    keep, _demo = R.keep_demo()

    # ------------------------------- the lift core beyond the entry hall
    s.begin_layer('ref')
    rx0, ry0, rx1, ry1 = D.REFERENCE
    ref, reft = frame.load_cad(x0=40000, y0=10000, x1=135000, y1=75000)
    for lay, x1, y1, x2, y2 in ref:
        if lay not in ('DA_WALL', 'DA_COLUMN', 'DA_STAIRCASE', 'DA_DOOR'):
            continue
        if not (rx0 < min(x1, x2) and max(x1, x2) < rx1
                and ry0 < min(y1, y2) and max(y1, y2) < ry1):
            continue
        s.line(x1, y1, x2, y2, '#a49c90' if lay != 'DA_COLUMN' else '#d69a95', 1.8)
    for lay, tx, ty, txt in reft:
        if rx0 < tx < rx1 and ry0 < ty < ry1 and txt.strip():
            s.text(tx, ty, txt.split('\n')[0], 12, '#8b8377')
    s.rect(rx0, 11125, rx1, ry1 - 100, fill='none',
           stroke='#b0a89c', stroke_width=2.0, stroke_dasharray='14 9')
    s.text((rx0 + rx1) / 2, ry1 + 200,
           'LIFT LOBBY, LIFTS AND FIRE LIFT — COMMON, NOT PART OF THE HOME',
           17, '#8b8377', weight='bold')
    s.end_layer()

    # -------------------------------------------------- keep-clear zones
    s.begin_layer('keepclear')
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
    s.end_layer()

    # kept builder walls sit on top of everything structural
    for x1, y1, x2, y2 in keep:
        s.line(x1, y1, x2, y2, '#3b3833', 3.4)

    # ---------------------------------------------------------- pod glazing
    # The west screen stops 300 short of the east one: the kitchen's bump
    # starts on this line, so the glass lands on the bump's corner and the
    # wall carries the line the rest of the way down.
    for P, y_end in ((D.POD_W, D.KIT_N), (D.POD_E, D.BODY_S)):
        ts = np.array([t for t in np.linspace(0, 1, 220)
                       if bez(P, t)[1] <= y_end])
        pts = [bez(P, t) for t in ts]
        a, b = D.POD_PORTAL_W if P is D.POD_W else D.POD_PORTAL_E
        s.path([p for p, t in zip(pts, ts) if t < a], GLAS, 5.0)
        s.path([p for p, t in zip(pts, ts) if t > b], GLAS, 5.0)
        s.path([p for p, t in zip(pts, ts) if a <= t <= b], GLAS, 1.6, dash='9 7')

    for x1, y1, x2, y2, kind in D.GLAZING:
        if kind == 'window':
            nx, ny = (0, 60) if y1 == y2 else (60, 0)
            for k in (-1, 1):
                s.line(x1 + nx * k, y1 + ny * k, x2 + nx * k, y2 + ny * k, GLAS, 2.0)
        else:
            s.line(x1, y1, x2, y2, GLAS, 4.0)

    # ---------------------------------------------------------- new walls
    for x1, y1, x2, y2, t, ops in D.NEW_WALLS:
        for q in wall_quads(x1, y1, x2, y2, t, ops):
            s.poly(q, fill=NEWW, stroke='none')
    for q in R.wc_wall():                # the guest WC's apse — same masonry
        s.poly(q, fill=NEWW, stroke='none')
    for q in R.mb_wall():                # the two master baths' sweep
        s.poly(q, fill=NEWW, stroke='none')
        s.poly(R.mirror_poly(q), fill=NEWW, stroke='none')
    for q in R.wc_door():                # its door, curved and drawn shut
        s.poly(q, fill='none', stroke=FURN, stroke_width=1.1)

    # ---------------------------------------------------------- furniture
    STYLE = {'solid': ('#ffffff', FURN, 1.1), 'soft': ('#efe9dd', FURN, 1.0),
             'light': ('none', FURN, 0.8), 'dash': ('none', '#b9ae9c', 1.0),
             'glass': ('#dde7ea', GLAS, 1.0), 'green': ('#cdd9c2', '#93a884', 1.0),
             'water': ('#dfeef2', '#8ab0bd', 1.1),
             'tint': ('#e2cfae', '#8a6440', 1.0),
             'wood': ('#b9884f', '#6b4426', 1.2),
             'plank': ('#e7dac6', 'none', 0),
             'board': ('none', '#cfb896', 0.7),
             'stone': ('#e3e3e0', '#c9c8c2', 0.9),
             'joint': ('none', '#d5d4cf', 0.7),
             'sconce': ('#f4e7c9', '#a8862f', 1.1),
             'ring': ('none', '#c9b393', 0.8),
             'leaf': ('#dfe3d4', '#a9b598', 0.7)}

    def prim(p):
        st = p[-1]
        fill, stroke, lw = STYLE[st]
        dash = ' stroke-dasharray="9 6"' if st == 'dash' else ''
        if p[0] == 'rect':
            _, x0, y0, x1, y1, _ = p
            s.o.append(f'<rect x="{s.X(x0):.1f}" y="{s.Y(y0):.1f}" '
                       f'width="{(x1 - x0) * s.sc:.1f}" height="{(y1 - y0) * s.sc:.1f}" '
                       f'fill="{fill}" stroke="{stroke}" stroke-width="{lw}"{dash}/>')
        elif p[0] == 'circle':
            _, ux, uy, r, _ = p
            s.o.append(f'<circle cx="{s.X(ux):.1f}" cy="{s.Y(uy):.1f}" '
                       f'r="{max(r * s.sc, 0.6):.1f}" fill="{fill}" stroke="{stroke}" '
                       f'stroke-width="{lw}"{dash}/>')
        elif p[0] == 'line':
            _, x0, y0, x1, y1, _ = p
            s.o.append(f'<line x1="{s.X(x0):.1f}" y1="{s.Y(y0):.1f}" '
                       f'x2="{s.X(x1):.1f}" y2="{s.Y(y1):.1f}" stroke="{stroke}" '
                       f'stroke-width="{lw}"{dash}/>')
        elif p[0] == 'poly':
            pts = ' '.join(f'{s.X(ux):.1f},{s.Y(uy):.1f}' for ux, uy in p[1])
            s.o.append(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" '
                       f'stroke-width="{lw}"{dash}/>')

    s.begin_layer('floor')
    for p in R.wood_floor(island=ISLAND):  # great room + deck bay, one board grid
        prim(p)
    for p in R.great_room_rug():       # full width, under everything else
        prim(p)
    s.end_layer()
    s.begin_layer('furniture')
    for p in R.terrace_pieces():       # grass, a tree and a jhoola on each
        prim(p)
    for p in R.kitchen_counter():      # run B, turning the corner of the bump
        prim(p)
    for p in R.hob_counter():          # the hob run + the appliance corner, one L
        prim(p)
    for p in R.magic_corner():         # run B's blind corner, shown stowed + out
        prim(p)
    for p in R.drum_kit():             # Karan's e-kit, in the den's SE corner
        prim(p)
    for kind, a, b, c, d, lab in D.FURNITURE:
        for p in SY.symbol(kind, a, b, c, d):
            prim(p)
    for p in R.suite_sliders():
        prim(p)
    for p in R.wc_console():
        prim(p)
    for p in R.mb_console() + R.mb_cabinet() + R.mb_shelves():
        prim(p)
        prim(R.mirror_prim(p))
    for p in R.mb_door():                       # the parents' bath door
        prim(p)
    for p in R.mb_door(D.MB_DOOR_E, hinge='N'):  # Karan's, moved and re-hung
        prim(R.mirror_prim(p))
    for p in R.arch_console_par():      # the parents' — cut by the sliding screen
        prim(p)
    for p in R.arch_console():          # Karan's — drawn mirrored
        prim(R.mirror_prim(p))
    for p in R.suite_screen():                  # Karan's dressing screen
        prim(p)
    for p in R.wc_out_door():
        prim(p)
    for p in R.corner_units():
        prim(p)
    for p in R.great_room_planter():   # answers the kitchen's bump across the room
        prim(p)
    for p in R.great_room_sofa():      # the 2-seater + the tree on its end
        prim(p)
    for p in R.rocking_chair(13080, 3500, face=(10123 - 13080, 3932 - 3500)):
        prim(p)
    for p in R.armchair(13800, 5050, (11640 - 13800, 4400 - 5050)):
        prim(p)                        # closes the group's east side                        # the one that closes the L, west half
    for p in R.console_top():          # lamps, books and a bowl on the console
        prim(p)
    for p in R.apse_sconces():         # the two wall lights on the apse
        prim(p)
    gx, gy, gr, gt, _g = D.GALLERY
    for r0, r1, a0, a1, back, lab in D.GALLERY_FURNITURE:
        for p in SY.annular(gx, gy, r0, r1, a0, a1, back):
            prim(p)
    s.end_layer()

    # ---------------------------------------------------- columns and beams
    for r_ in cols:
        s.rect(*r_, fill=KEEP, stroke='#7c1610', stroke_width=1.0)

    # The entry gallery goes on last, so that the two columns it is built on
    # disappear into it and the U reads as one continuous wall.
    cx, cy, r, t, gaps = D.GALLERY
    for q in arc_quads(cx, cy, r, t, gaps):
        s.poly(q, fill=WOOD, stroke=WOOD, stroke_width=0.8)
    for x1, y1, x2, y2, t, ops in D.SCREEN_WALLS:
        for q in wall_quads(x1, y1, x2, y2, t, ops):
            s.poly(q, fill=WOOD, stroke=WOOD, stroke_width=0.8)
    for q in R.arch_haunches():          # springer blocks, arch on to leg
        s.poly(q, fill=WOOD, stroke=WOOD, stroke_width=0.8)
    for q in R.arch_doors():             # the door on the axis, shut
        s.poly(q, fill=WOODL, stroke=WOOD, stroke_width=1.2)
    for p in R.gal_swing_doors():        # the two service doors, hinged glass
        prim(p)

    # --------------------------------------------------------------- labels
    s.begin_layer('labels')
    for name, sub, rects, note, anchor in D.ROOMS:
        if not rects:
            continue
        big = max(rects, key=lambda r_: (r_[2] - r_[0]) * (r_[3] - r_[1]))
        cx_, cy_ = anchor or ((big[0] + big[2]) / 2, (big[1] + big[3]) / 2)
        A = R.rect_room_area(name, rects)
        s.text(cx_, cy_ - 150, name, 22 if A > 8 else 16, TXT, weight='bold', letter=1.4)
        if sub:
            s.text(cx_, cy_ + 90, sub, 14, '#2c5c61', letter=2.5)
        s.text(cx_, cy_ + (230 if sub else 130),
               f'{A:.1f} m²  ·  {A * 10.7639:.0f} sq ft', 13, TXT2)
        if note:
            s.text(cx_, cy_ + (400 if sub else 300), note, 11, TXT2)

    # the rooms that are not rectangles — pods, great room, and the three
    # round the entry drum — measured off their own polygons
    for nm, sub, p, note, (lx_, ly_) in R.poly_rooms():
        A = R.poly_area(p)
        big = A > 25
        # letter-spaced through the attribute, not by joining with spaces: SVG
        # collapses runs of whitespace, so ' '.join eats the gap between words
        # and MASTER SUITE comes out as MASTERSUITE.
        s.text(lx_, ly_, nm, 30 if big else 19, TXT, weight='bold',
               letter=9 if big else 1.4)
        dy = 330 if big else 250
        if sub:
            s.text(lx_, ly_ + dy, sub, 15 if big else 14, '#2c5c61', letter=2.5)
            dy += 230 if big else 200
        s.text(lx_, ly_ + dy,
               f'{A:.1f} m²  ·  {A * 10.7639:.0f} sq ft', 14 if big else 13, TXT2)
        if note:
            s.text(lx_, ly_ + dy + (230 if big else 200), note, 11, TXT2)
    s.end_layer()

    # ----------------------------------------------------------- dimensions
    s.begin_layer('dims')
    for x1, y1, x2, y2, _prefix in D.DIMS:
        txt = _prefix + f'{math.hypot(x2 - x1, y2 - y1):,.0f}'.replace(',', ' ')
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

    s.end_layer()

    # ---------------------------------------------------------------- title
    s.begin_layer('title')
    s.text(-3000, -2050, 'FULL-FLOOR RESIDENCE  —  ROUND 1', 30, INK, anchor='start',
           weight='bold')
    s.text(-3000, -1780, 'A-101 SET OUT ON THE BUILDER SHELL  ·  ALL COLUMNS, BEAMS, '
                         'SHAFTS, DUCTS AND VOIDS HONOURED', 14, TXT2, anchor='start')
    s.text(-3000, -1560, 'DIMENSIONS IN MILLIMETRES  ·  CONCEPT DRAWING, NOT FOR '
                         'CONSTRUCTION', 12, '#9a9184', anchor='start')

    lx, ly = -3000, 14700
    for i, (col, txt) in enumerate([
            (SLAB, 'builder slab'),
            ('#a49c90', 'lift core and landing beyond the flat — reference only'),
            (KEEP, 'builder column / beam, and keep-clear shaft, duct or void'),
            (NEWW, 'new masonry — every wall is new, every opening a gap in it'),
            (GLAS, 'glazing / sliding glass'),
            (WOOD, 'the U of the entry gallery — 230, on the two columns'),
            (WOODL, 'curved doors, drawn shut — they slide on the arc'),
            ('#b9884f', "Karan's dressing partition — wood dado, tinted "
                        'glass over it')]):
        s.o.append(f'<rect x="{s.X(lx):.1f}" y="{s.Y(ly) + i * 26 - 13:.0f}" width="34" '
                   f'height="17" fill="{col}" stroke="#888" stroke-width="0.6"/>')
        s.o.append(f'<text x="{s.X(lx) + 46:.1f}" y="{s.Y(ly) + i * 26:.0f}" '
                   f'font-size="15" fill="{TXT}" '
                   f'font-family="Helvetica,Arial,sans-serif">{esc(txt)}</text>')
    s.end_layer()

    s.save('07-round1-layout')


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
