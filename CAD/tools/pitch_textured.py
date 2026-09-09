"""
The textured plan for the family pitch: the same geometry as the review
drawing, drawn as materials instead of linework.  Every room gets its real
floor finish, furniture casts a soft shadow, lamps and trees throw light.

    python3 tools/pitch_textured.py

Writes out/pitch/textured.svg/.png.  Engineering apparatus — dimensions,
keep-clear hatching, the legend — is deliberately absent: this sheet is for
the family, not the architect.  MuPDF's SVG renderer has no gradients, so
every glow is built from concentric translucent circles and every material
from scattered opaque marks.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fitz
import numpy as np
from matplotlib.path import Path as MplPath

import home
home.select()          # --home / $OM_HOME / om-neeldhara
import clash as C
import design as D
import retrofit as R
import symbols as SY
from draw_design import Sheet, wall_quads, arc_quads, esc, bez

OUT = os.path.join(HERE, '..', 'out', 'pitch')
os.makedirs(OUT, exist_ok=True)

PAPER = '#f5eddd'
SLAB = '#ece4d2'
NEWW = '#2a2117'
GLAS = '#4a90a8'
WOOD = '#7d5a33'
WOODL = '#c8a266'
TXT = '#2a2724'
TXT2 = '#8a8072'

# deterministic scatter — the same sheet every run
RNG = np.random.default_rng(14)

STYLE = {'solid': ('#fdfaf3', '#a89b88', 1.1),
         'soft': ('#e9dcc3', '#b3a288', 1.0),
         'light': ('none', '#a89b88', 0.8),
         'dash': ('none', '#b4a98f', 1.0),
         'glass': ('#d3e4e8', GLAS, 1.0),
         'green': ('#b5c9a2', '#87a072', 1.0),
         'water': ('#cfe6ec', '#7fabb9', 1.1),
         'tint': ('#dbc394', '#7d5a33', 1.0),
         'wood': ('#a97e48', '#5f3d20', 1.2),
         'plank': ('#dcc49b', 'none', 0),
         'board': ('none', '#b99a6c', 0.8),
         'stone': ('#e0ddd2', '#c6c2b4', 0.9),
         'joint': ('none', '#ccc8ba', 0.7),
         'sconce': ('#f6e5b4', '#a8862f', 1.1),
         'ring': ('none', '#b99a6c', 0.8),
         'leaf': ('#cbd6b8', '#93a67c', 0.7)}

# room name -> floor finish
FLOORS = {'MASTER SUITE': 'oak', 'MUSIC + WORK DEN': 'oak',
          'FAMILY ROOM': 'oak', 'HELP’S ROOM': 'oak',
          "HELP'S ROOM": 'oak',
          'KITCHEN': 'stone', 'ENTRY GALLERY': 'stone', 'STORE': 'stone',
          'PARENTS’ BATH': 'stone', "PARENTS' BATH": 'stone',
          'KARAN’S BATH': 'stone', "KARAN'S BATH": 'stone',
          'GUEST / SERVICE WC': 'stone'}
OAK = '#e6cfa6'
OAK_LINE = '#cbab7c'
STONE = '#e3e0d5'
STONE_LINE = '#cdc9bb'


def scatter_in(poly, n):
    """n deterministic points inside a polygon, via rejection sampling."""
    xs, ys = zip(*poly)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    P = MplPath(poly)
    out = []
    tries = 0
    while len(out) < n and tries < 40:
        m = (n - len(out)) * 3
        pts = np.column_stack([RNG.uniform(x0, x1, m), RNG.uniform(y0, y1, m)])
        out += [tuple(p) for p in pts[P.contains_points(pts)]]
        tries += 1
    return out[:n]


class TSheet(Sheet):
    def save_to(self, name, mat=1.6):
        self.o.append('</svg>')
        svg = os.path.join(OUT, name + '.svg')
        open(svg, 'w').write('\n'.join(self.o))
        fitz.open(svg)[0].get_pixmap(matrix=fitz.Matrix(mat, mat)).save(
            os.path.join(OUT, name + '.png'))
        print('wrote', os.path.join(OUT, name + '.png'))


def main():
    lay = C.builder_layers()
    bl = max(lay['DA_BUILDING LINE'], key=len)
    cols = C.rects(lay['DA_COLUMN']) + C.beam_rects()

    s = TSheet(-1600, -1300, 26200, 12400, width=4600, pad=70)
    # repaint the paper in the pitch tone, over the Sheet default
    s.o.append(f'<rect width="100%" height="100%" fill="{PAPER}"/>')

    s.poly(bl, fill=SLAB, stroke='#c4bca9', stroke_width=1.2)

    keep, _demo = R.keep_demo()

    # ------------------------------------------------ floor finishes, room by room
    def oak_fill(poly):
        s.poly(poly, fill=OAK, stroke='none')
        xs, ys = zip(*poly)
        x0, x1 = min(xs), max(xs)
        P = MplPath(poly)
        # board lines every 190, run north-south like the deck's
        for bx in np.arange(x0 + 95, x1, 190):
            ys_ = np.arange(min(ys), max(ys), 60)
            pts = np.column_stack([np.full_like(ys_, bx), ys_])
            inside = P.contains_points(pts)
            run = []
            for (px, py), ok in zip(pts, inside):
                if ok:
                    run.append((px, py))
                elif run:
                    s.line(run[0][0], run[0][1], run[-1][0], run[-1][1],
                           OAK_LINE, 0.55)
                    run = []
            if run:
                s.line(run[0][0], run[0][1], run[-1][0], run[-1][1],
                       OAK_LINE, 0.55)
        # grain flecks
        for px, py in scatter_in(poly, max(6, int(abs((x1 - x0)) // 400))):
            s.line(px, py - 60, px, py + 60, '#c9a877', 0.8)

    def stone_fill(poly):
        s.poly(poly, fill=STONE, stroke='none')
        xs, ys = zip(*poly)
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        P = MplPath(poly)
        for gx in np.arange(x0 + 300, x1, 600):
            for gy in np.arange(y0 + 300, y1, 600):
                if P.contains_point((gx, gy)):
                    s.line(gx - 210, gy, gx + 210, gy, STONE_LINE, 0.5)
                    s.line(gx, gy - 210, gx, gy + 210, STONE_LINE, 0.5)
        for px, py in scatter_in(poly, 24):
            s.o.append(f'<circle cx="{s.X(px):.1f}" cy="{s.Y(py):.1f}" r="1.1" '
                       f'fill="#c9c4b2" opacity="0.8"/>')

    def room_polys():
        for name, sub, rects, note, anchor in D.ROOMS:
            for r_ in rects:
                yield name, [(r_[0], r_[1]), (r_[2], r_[1]),
                             (r_[2], r_[3]), (r_[0], r_[3])]
        for nm, sub, p, note, _a in R.poly_rooms():
            yield nm, p

    for name, poly in room_polys():
        fin = FLOORS.get(name)
        if fin == 'oak':
            oak_fill(poly)
        elif fin == 'stone':
            stone_fill(poly)
        elif name == 'MASTER SUITE':
            oak_fill(poly)
    # both master suites come from poly_rooms under the same name
    for nm, sub, p, note, _a in R.poly_rooms():
        if nm == 'MASTER SUITE':
            oak_fill(p)

    # ------------------------------------------------------------- the shell
    for x1, y1, x2, y2 in keep:
        s.line(x1, y1, x2, y2, '#4a443b', 3.2)

    for P_, y_end in ((D.POD_W, D.KIT_N), (D.POD_E, D.BODY_S)):
        ts = np.array([t for t in np.linspace(0, 1, 220)
                       if bez(P_, t)[1] <= y_end])
        pts = [bez(P_, t) for t in ts]
        a, b = D.POD_PORTAL_W if P_ is D.POD_W else D.POD_PORTAL_E
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
            # a pale sheen beside every slider, the hint of glass
            if y1 == y2:
                s.rect(min(x1, x2), y1 - 55, max(x1, x2), y1 + 55,
                       fill='#dcebee', stroke='none', opacity='0.5')
            else:
                s.rect(x1 - 55, min(y1, y2), x1 + 55, max(y1, y2),
                       fill='#dcebee', stroke='none', opacity='0.5')

    for x1, y1, x2, y2, t, ops in D.NEW_WALLS:
        for q in wall_quads(x1, y1, x2, y2, t, ops):
            s.poly(q, fill=NEWW, stroke='none')
    for q in R.wc_wall():
        s.poly(q, fill=NEWW, stroke='none')
    for q in R.mb_wall() + R.east_polys(R.mb_wall):
        s.poly(q, fill=NEWW, stroke='none')
    for q in R.wc_door():
        s.poly(q, fill='none', stroke='#a89b88', stroke_width=1.1)

    # --------------------------------------------------------- the furniture
    glow_pts = []      # (x, y, r, warm) collected while drawing
    SHADOW = 'rgba(60,45,25,0.13)'

    def prim(p, shadow=True):
        st = p[-1]
        fill, stroke, lw = STYLE[st]
        dash = ' stroke-dasharray="9 6"' if st == 'dash' else ''
        if st == 'sconce' and p[0] in ('circle', 'poly', 'rect'):
            if p[0] == 'circle':
                glow_pts.append((p[1], p[2], 620, True))
            elif p[0] == 'rect':
                glow_pts.append(((p[1] + p[3]) / 2, (p[2] + p[4]) / 2, 620, True))
            else:
                xs = [q[0] for q in p[1]]
                ys = [q[1] for q in p[1]]
                glow_pts.append((sum(xs) / len(xs), sum(ys) / len(ys), 620, True))
        if st == 'dash' and p[0] == 'circle' and p[3] >= 400:
            glow_pts.append((p[1], p[2], p[3] * 1.15, False))   # tree canopies
        if shadow and st in ('solid', 'soft') and p[0] in ('rect', 'poly'):
            dx, dy = 40, 52
            if p[0] == 'rect':
                _, x0, y0, x1, y1, _ = p
                s.o.append(f'<rect x="{s.X(x0 + dx):.1f}" y="{s.Y(y0 + dy):.1f}" '
                           f'width="{(x1 - x0) * s.sc:.1f}" '
                           f'height="{(y1 - y0) * s.sc:.1f}" rx="4" '
                           f'fill="{SHADOW}"/>')
            else:
                pts = ' '.join(f'{s.X(ux + dx):.1f},{s.Y(uy + dy):.1f}'
                               for ux, uy in p[1])
                s.o.append(f'<polygon points="{pts}" fill="{SHADOW}"/>')
        if p[0] == 'rect':
            _, x0, y0, x1, y1, _ = p
            s.o.append(f'<rect x="{s.X(x0):.1f}" y="{s.Y(y0):.1f}" '
                       f'width="{(x1 - x0) * s.sc:.1f}" '
                       f'height="{(y1 - y0) * s.sc:.1f}" '
                       f'fill="{fill}" stroke="{stroke}" stroke-width="{lw}"{dash}/>')
        elif p[0] == 'circle':
            _, ux, uy, r_, _ = p
            s.o.append(f'<circle cx="{s.X(ux):.1f}" cy="{s.Y(uy):.1f}" '
                       f'r="{max(r_ * s.sc, 0.6):.1f}" fill="{fill}" '
                       f'stroke="{stroke}" stroke-width="{lw}"{dash}/>')
        elif p[0] == 'line':
            _, x0, y0, x1, y1, _ = p
            s.o.append(f'<line x1="{s.X(x0):.1f}" y1="{s.Y(y0):.1f}" '
                       f'x2="{s.X(x1):.1f}" y2="{s.Y(y1):.1f}" stroke="{stroke}" '
                       f'stroke-width="{lw}"{dash}/>')
        elif p[0] == 'poly':
            pts = ' '.join(f'{s.X(ux):.1f},{s.Y(uy):.1f}' for ux, uy in p[1])
            s.o.append(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" '
                       f'stroke-width="{lw}"{dash}/>')

    for p in R.wood_floor():
        prim(p, shadow=False)
    for p in R.terrace_pieces():
        prim(p)
    for p in R.great_room_rug():
        prim(p, shadow=False)
    for p in R.kitchen_counter():
        prim(p)
    for p in R.hob_counter():
        prim(p)
    for p in R.magic_corner():
        prim(p)
    for p in R.drum_kit():
        prim(p)
    for kind, a, b, c, d, lab in D.FURNITURE:
        for p in SY.symbol(kind, a, b, c, d):
            prim(p)
    for p in R.suite_sliders():
        prim(p)
    for p in R.wc_console():
        prim(p)
    for p in (R.mb_console() + R.mb_cabinet() + R.mb_shelves()
              + R.east(R.mb_console) + R.east(R.mb_cabinet) + R.east(R.mb_shelves)):
        prim(p)
    for p in R.mb_door(D.MB_DOOR_P) + R.mb_door():
        prim(p, shadow=False)
    for p in R.bath_divider():
        prim(p)
    for p in R.help_rack():
        prim(p)
    for p in R.east(R.mb_door, D.MB_DOOR_E, hinge='N'):
        prim(p, shadow=False)
    for p in R.arch_console_par():
        prim(p)
    for p in R.east(R.arch_console):
        prim(p)
    for p in R.suite_screen():
        prim(p, shadow=False)
    for p in R.wc_out_door():
        prim(p, shadow=False)
    for p in R.corner_units():
        prim(p)
    for p in R.great_room_planter():
        prim(p)
    for p in R.great_room_sofa():
        prim(p)
    for p in R.rocking_chair(13080, 3500, face=(10123 - 13080, 3932 - 3500)):
        prim(p)
    for p in R.armchair(13800, 5050, (11640 - 13800, 4400 - 5050)):
        prim(p)
    for p in R.console_top():
        prim(p, shadow=False)
    for p in R.apse_sconces():
        prim(p, shadow=False)

    # ----------------------------------------------------- columns and beams
    for r_ in cols:
        s.rect(*r_, fill='#8e2b23', stroke='#6d1c15', stroke_width=0.8)

    cx, cy, r, t, gaps = D.GALLERY
    for q in arc_quads(cx, cy, r, t, gaps):
        s.poly(q, fill=WOOD, stroke=WOOD, stroke_width=0.8)
    for x1, y1, x2, y2, t, ops in D.SCREEN_WALLS:
        for q in wall_quads(x1, y1, x2, y2, t, ops):
            s.poly(q, fill=WOOD, stroke=WOOD, stroke_width=0.8)
    for q in R.arch_haunches():
        s.poly(q, fill=WOOD, stroke=WOOD, stroke_width=0.8)
    for q in R.arch_doors():
        s.poly(q, fill=WOODL, stroke=WOOD, stroke_width=1.2)
    for p in R.gal_swing_doors():
        prim(p, shadow=False)

    # ------------------------------------------------------ light, laid over
    # no gradients in MuPDF's SVG: a glow is six concentric translucent discs
    glow_pts.append((12240, 1160, 900, False))         # the fountain
    for gx, gy, gr, warm in glow_pts:
        col = '#ffdf9e' if warm else '#fff3c9'
        for i in range(6):
            rr = gr * (1 - i / 6)
            s.o.append(f'<circle cx="{s.X(gx):.1f}" cy="{s.Y(gy):.1f}" '
                       f'r="{rr * s.sc:.1f}" fill="{col}" opacity="0.055"/>')

    # ---------------------------------------------------------------- labels
    for name, sub, rects, note, anchor in D.ROOMS:
        if not rects:
            continue
        big = max(rects, key=lambda r_: (r_[2] - r_[0]) * (r_[3] - r_[1]))
        cx_, cy_ = anchor or ((big[0] + big[2]) / 2, (big[1] + big[3]) / 2)
        A = R.rect_room_area(name, rects)
        s.text(cx_, cy_ - 130, name, 20 if A > 8 else 15, TXT, weight='bold',
               letter=1.4)
        s.text(cx_, cy_ + 120, f'{A:.1f} m²  ·  {A * 10.7639:.0f} sq ft', 12, TXT2)
    for nm, sub, p, note, (lx_, ly_) in R.poly_rooms():
        A = R.poly_area(p)
        big = A > 25
        s.text(lx_, ly_, nm, 28 if big else 18, TXT, weight='bold',
               letter=8 if big else 1.4)
        dy = 300 if big else 230
        s.text(lx_, ly_ + dy, f'{A:.1f} m²  ·  {A * 10.7639:.0f} sq ft', 13, TXT2)

    s.text(-1400, -950, 'OM NEELDHARA  ·  FLOOR 14', 26, TXT, anchor='start',
           weight='bold', letter=3)
    s.text(-1400, -680, 'THE HOME IN ITS MATERIALS  —  OAK, STONE, GRASS, '
                        'GLASS AND LIGHT', 14, TXT2, anchor='start', letter=1)

    s.save_to('textured')


if __name__ == '__main__':
    main()
