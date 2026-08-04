"""
Indicative room views for the family pitch — one-point-perspective interior
illustrations generated straight from the plan's own geometry, so a sofa in
a view stands exactly where the sofa stands on the sheet.

    python3 tools/pitch_persp.py

Writes out/pitch/view-*.png.  These are stylised architectural sketches, not
photographs; each is captioned as indicative at assembly.

The camera is always axis-aligned (a one-point view), standing at eye height
1550 mm.  Furniture comes from design.FURNITURE extruded to catalogue
heights; curved joinery comes from the retrofit functions' own footprints.
Painter's algorithm, far to near.  MuPDF's SVG has no gradients, so light is
layered translucent discs and sky is flat bands.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fitz
import numpy as np

import design as D
import retrofit as R

OUT = os.path.join(HERE, '..', 'out', 'pitch')
os.makedirs(OUT, exist_ok=True)

W, H = 1480, 1000
EYE = 1550.0          # standing eye height, mm
CEIL = 3050.0         # indicative clear ceiling
NEAR = 420.0          # depth clamp
F = W / (2 * math.tan(math.radians(87) / 2))   # focal, px — a wide
# interior lens; anything narrower drops all near furniture below
# the frame and every room reads as empty wall

# palette
SKY = ['#dfeaf0', '#e8f0f2', '#f2f5f0']
GREEN_FAR = '#a8bd93'
CEIL_COL = '#f3efe6'
WALL = '#eee8da'
WALL_SIDE = '#e4dccb'
OAKF = '#d9be92'
OAK_LINE = '#c2a577'
STONEF = '#dedbd0'
STONE_LINE = '#ccc8ba'
GLASS_T = '#78aab9'
GLASS_EDGE = '#5b8fa0'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def shade(hexcol, k):
    """darken (k<1) or lighten (k>1) a #rrggbb colour."""
    r = int(hexcol[1:3], 16)
    g = int(hexcol[3:5], 16)
    b = int(hexcol[5:7], 16)
    if k >= 1:
        r = int(r + (255 - r) * (k - 1))
        g = int(g + (255 - g) * (k - 1))
        b = int(b + (255 - b) * (k - 1))
    else:
        r, g, b = int(r * k), int(g * k), int(b * k)
    return f'#{min(r,255):02x}{min(g,255):02x}{min(b,255):02x}'


class View:
    """Axis-aligned one-point camera at (cx, cy), looking along axis."""

    def __init__(self, cx, cy, axis, title=''):
        self.c = np.array([cx, cy], float)
        self.axis = axis                    # '+y' south, '-y' north, '+x', '-x'
        d = {'+x': (1, 0), '-x': (-1, 0), '+y': (0, 1), '-y': (0, -1)}[axis]
        self.d = np.array(d, float)
        self.r = np.array([-d[1], d[0]], float)      # right-hand lateral
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" '
                  f'height="{H}">']
        self.title = title


    # ------------------------------------------------- near-plane clipping
    def clip_rect(self, x0, y0, x1, y1):
        """Clip an axis-aligned world rect against depth >= NEAR."""
        if self.axis == '-y':
            y0 = min(y0, self.c[1] - NEAR)
            y1 = min(y1, self.c[1] - NEAR) if y1 > self.c[1] - NEAR else y1
            y1 = min(y1, self.c[1] - NEAR)
        elif self.axis == '+y':
            y0 = max(y0, self.c[1] + NEAR)
        elif self.axis == '-x':
            x1 = min(x1, self.c[0] - NEAR)
        else:
            x0 = max(x0, self.c[0] + NEAR)
        if x0 >= x1 or y0 >= y1:
            return None
        return x0, y0, x1, y1

    # ---------------------------------------------------------- projection
    def depth(self, x, y):
        return (np.array([x, y]) - self.c) @ self.d

    def pt(self, x, y, z):
        p = np.array([x, y]) - self.c
        t = max(p @ self.d, NEAR)
        l = p @ self.r
        sx = W / 2 + F * l / t
        sy = H * 0.44 - F * (z - EYE) / t
        return sx, sy

    def poly(self, pts3, fill, stroke='none', lw=1.0, opacity=None):
        pp = ' '.join(f'{x:.1f},{y:.1f}' for x, y in
                      (self.pt(*p) for p in pts3))
        op = f' opacity="{opacity}"' if opacity else ''
        self.o.append(f'<polygon points="{pp}" fill="{fill}" stroke="{stroke}" '
                      f'stroke-width="{lw}"{op}/>')

    def line3(self, a, b, col, lw=1.0, opacity=None):
        x0, y0 = self.pt(*a)
        x1, y1 = self.pt(*b)
        op = f' opacity="{opacity}"' if opacity else ''
        self.o.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" '
                      f'y2="{y1:.1f}" stroke="{col}" stroke-width="{lw}"{op}/>')

    # ------------------------------------------------------------- scenery
    def backdrop(self):
        h = int(H * 0.44)
        for i, col in enumerate(SKY):
            self.o.append(f'<rect x="0" y="{h * i // 3}" width="{W}" '
                          f'height="{h // 3 + 2}" fill="{col}"/>')
        self.o.append(f'<rect x="0" y="{h}" width="{W}" height="{H - h}" '
                      f'fill="{GREEN_FAR}"/>')

    def floor(self, x0, y0, x1, y1, mat='oak', boards='x'):
        r_ = self.clip_rect(x0, y0, x1, y1)
        if not r_:
            return
        x0, y0, x1, y1 = r_
        base = OAKF if mat == 'oak' else STONEF if mat == 'stone' else '#b5c9a2'
        self.poly([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], base)
        lc = OAK_LINE if mat == 'oak' else STONE_LINE
        step = 190 if mat == 'oak' else 600
        if mat == 'green':
            return
        if boards == 'x':                       # boards run east-west
            for by in np.arange(y0 + step, y1, step):
                self.line3((x0, by, 0), (x1, by, 0), lc, 0.8)
        else:
            for bx in np.arange(x0 + step, x1, step):
                self.line3((bx, y0, 0), (bx, y1, 0), lc, 0.8)
        if mat == 'stone':
            for by in np.arange(y0 + step, y1, step):
                self.line3((x0, by, 0), (x1, by, 0), lc, 0.7)

    def ceiling(self, x0, y0, x1, y1, spots=()):
        r_ = self.clip_rect(x0, y0, x1, y1)
        if not r_:
            return
        x0, y0, x1, y1 = r_
        self.poly([(x0, y0, CEIL), (x1, y0, CEIL), (x1, y1, CEIL),
                   (x0, y1, CEIL)], CEIL_COL)
        for sx, sy in spots:
            px, py = self.pt(sx, sy, CEIL - 20)
            t = self.depth(sx, sy)
            r = max(2.5, F * 90 / max(t, NEAR))
            self.o.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r:.1f}" '
                          f'fill="#f8e9bd" stroke="#d8c690" stroke-width="1"/>')

    def wall(self, x0, y0, x1, y1, kind='wall', z0=0, z1=CEIL, openings=()):
        """A vertical plane.  openings: (a, b, otype) along the wall's run."""
        # clip the run against the near plane
        if x0 == x1 and self.axis in ('+y', '-y'):     # runs north-south
            lo, hi = min(y0, y1), max(y0, y1)
            if self.axis == '-y':
                hi = min(hi, self.c[1] - NEAR)
            else:
                lo = max(lo, self.c[1] + NEAR)
            if lo >= hi:
                return
            y0, y1 = (lo, hi) if y0 < y1 else (hi, lo)
        if y0 == y1 and self.axis in ('+x', '-x'):     # runs east-west
            lo, hi = min(x0, x1), max(x0, x1)
            if self.axis == '-x':
                hi = min(hi, self.c[0] - NEAR)
            else:
                lo = max(lo, self.c[0] + NEAR)
            if lo >= hi:
                return
            x0, x1 = (lo, hi) if x0 < x1 else (hi, lo)
        if y0 == y1 and self.axis in ('+y', '-y'):     # a facing wall behind us
            if (self.depth(x0, y0)) < NEAR * 0.5:
                return
        if x0 == x1 and self.axis in ('+x', '-x'):
            if (self.depth(x0, y0)) < NEAR * 0.5:
                return
        L = math.hypot(x1 - x0, y1 - y0)
        ux, uy = (x1 - x0) / L, (y1 - y0) / L

        def seg(a, b, zz0, zz1, fill, opacity=None, stroke='none'):
            ax, ay = x0 + ux * a, y0 + uy * a
            bx, by = x0 + ux * b, y0 + uy * b
            self.poly([(ax, ay, zz0), (bx, by, zz0), (bx, by, zz1),
                       (ax, ay, zz1)], fill, stroke=stroke, opacity=opacity)

        col = {'wall': WALL, 'side': WALL_SIDE, 'dark': '#3a3226',
               'wood': '#9a713d', 'screen': '#a97e48'}.get(kind, WALL)
        if kind == 'glasskin':
            # ONLY the glass and its mullions — whatever stands beyond has
            # already been drawn, and stays visible through the skin
            seg(0, L, z0, z1, GLASS_T, opacity=0.20)
            n = max(2, int(L // 1600))
            for i in range(n + 1):
                a = L * i / n
                seg(max(0, a - 12), min(L, a + 12), z0, z1, '#7fa3ad')
            seg(0, L, z0, z0 + 30, '#7fa3ad')
            return
        if kind == 'glass':
            # scenery beyond, then the glass skin and mullions
            seg(0, L, 0, CEIL * 0.42, GREEN_FAR)
            seg(0, L, CEIL * 0.42, z1, '#e4edf0')
            seg(0, L, z0, z1, GLASS_T, opacity=0.28)
            n = max(2, int(L // 1600))
            for i in range(n + 1):
                a = L * i / n
                seg(max(0, a - 12), min(L, a + 12), z0, z1, '#7fa3ad')
            seg(0, L, z0, z0 + 30, '#7fa3ad')
            return
        seg(0, L, z0, z1, col)
        for a, b, ot in openings:
            if ot == 'glass':
                seg(a, b, 0, CEIL * 0.42, GREEN_FAR)
                seg(a, b, CEIL * 0.42, CEIL, '#e4edf0')
                seg(a, b, 0, CEIL, GLASS_T, opacity=0.28)
                seg(a, b, 0, 30, '#7fa3ad')
            elif ot == 'door':
                seg(a, b, 0, 2100, '#8d7a5c')
                seg(a + 40, b - 40, 60, 2040, '#a58f6d')
            elif ot == 'open':
                seg(a, b, 0, 2400, '#c9bda6')
            elif ot == 'warm':                       # a lit room beyond
                seg(a, b, 0, 2400, '#e8d9b4')
            elif ot == 'arch':
                # a round-headed opening: rect to springing + arc crown
                spring = 1600
                rr = (b - a) / 2
                seg(a, b, 0, spring, '#e8d9b4')
                mid = (a + b) / 2
                pts = []
                for t in np.linspace(0, math.pi, 20):
                    aa = mid + math.cos(t) * rr
                    pts.append((x0 + ux * aa, y0 + uy * aa,
                                spring + math.sin(t) * rr))
                pp = ' '.join(f'{x:.1f},{y:.1f}' for x, y in
                              (self.pt(*p) for p in pts))
                self.o.append(f'<polygon points="{pp}" fill="#e8d9b4"/>')
            elif ot == 'window':
                seg(a, b, 900, 2400, '#dfeaf0')
                seg(a, b, 900, 2400, GLASS_T, opacity=0.25)
                seg(a, b, 890, 930, '#b9b0a0')

    def screen_bezier(self, P, portal, y_end, dado=None):
        """A pod's curved glass screen, sampled from its own bezier."""
        ts = [t for t in np.linspace(0, 1, 90) if R.bez(P, t)[1] <= y_end]
        for t0, t1 in zip(ts, ts[1:]):
            a = R.bez(P, t0)
            b = R.bez(P, t1)
            inside = portal[0] <= (t0 + t1) / 2 <= portal[1]
            if inside:
                continue                        # the open portal
            if dado:
                self.poly([(a[0], a[1], 0), (b[0], b[1], 0),
                           (b[0], b[1], dado), (a[0], a[1], dado)], '#9a713d')
                self.poly([(a[0], a[1], dado), (b[0], b[1], dado),
                           (b[0], b[1], 2600), (a[0], a[1], 2600)],
                          '#967846', opacity=0.30)
            else:
                self.poly([(a[0], a[1], 0), (b[0], b[1], 0),
                           (b[0], b[1], 2600), (a[0], a[1], 2600)],
                          '#78aab9', opacity=0.26)
        # top and bottom rails
        pts0 = [R.bez(P, t) for t in ts]
        for z in (30, 2600):
            for a, b in zip(pts0, pts0[1:]):
                self.line3((a[0], a[1], z), (b[0], b[1], z), '#7fa3ad', 1.4)

    # ------------------------------------------------------------ furniture
    def box(self, x0, y0, x1, y1, z1, col, z0=0, shadow=True, top=None):
        """An axis-aligned box, painter-correct for this camera."""
        if shadow and z0 == 0:
            g = 90
            self.poly([(x0 - g, y0 - g, 1), (x1 + g, y0 - g, 1),
                       (x1 + g, y1 + g, 1), (x0 - g, y1 + g, 1)],
                      '#3c2d19', opacity=0.14)
        faces = []
        # candidate side faces with outward normals
        sides = [((x0, y0), (x1, y0), (0, -1)), ((x1, y0), (x1, y1), (1, 0)),
                 ((x1, y1), (x0, y1), (0, 1)), ((x0, y1), (x0, y0), (-1, 0))]
        for (ax, ay), (bx, by), n in sides:
            mx, my = (ax + bx) / 2, (ay + by) / 2
            tocam = self.c - np.array([mx, my])
            if tocam @ np.array(n) > 0:
                facing = abs(np.array(n) @ self.d)
                k = 0.97 if facing > 0.5 else 0.86
                faces.append(([(ax, ay, z0), (bx, by, z0), (bx, by, z1),
                               (ax, ay, z1)], shade(col, k)))
        for f_, c_ in faces:
            self.poly(f_, c_, stroke=shade(col, 0.72), lw=0.8)
        if EYE > z1:
            self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1),
                       (x0, y1, z1)], top or shade(col, 1.10),
                      stroke=shade(col, 0.72), lw=0.8)

    def tree(self, x, y, ht=2200, rr=800, trunk=140):
        t = self.depth(x, y)
        if t < NEAR:
            return
        self.box(x - trunk / 2, y - trunk / 2, x + trunk / 2, y + trunk / 2,
                 ht * 0.45, '#7d5a33', shadow=False)
        px, py = self.pt(x, y, ht * 0.62)
        r = F * rr / t
        for dx, dy, k in ((0, 0, 1.0), (-0.55, -0.25, 0.62), (0.5, -0.35, 0.66),
                          (-0.3, 0.4, 0.55), (0.42, 0.3, 0.5), (0, -0.55, 0.5)):
            self.o.append(f'<circle cx="{px + dx * r:.1f}" cy="{py + dy * r:.1f}" '
                          f'r="{r * k:.1f}" fill="#8fae76" opacity="0.85" '
                          f'stroke="#71905c" stroke-width="1"/>')

    def glow(self, x, y, z, rr=700, col='#ffe9b0'):
        t = self.depth(x, y)
        if t < NEAR:
            return
        px, py = self.pt(x, y, z)
        r = F * rr / t
        for i in range(5):
            self.o.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" '
                          f'r="{r * (1 - i / 5):.1f}" fill="{col}" '
                          f'opacity="0.07"/>')

    def flat(self, prims, keep=lambda p: True):
        """Project plan primitives on to the floor — rugs, grass, water."""
        COLS = {'soft': '#e6d9bf', 'green': '#a9bf95', 'water': '#c6e0e8',
                'plank': OAKF, 'board': OAK_LINE, 'stone': STONEF,
                'solid': '#f4efe4', 'wood': '#a97e48', 'tint': '#dbc394'}
        for p in prims:
            st = p[-1]
            if st not in COLS or not keep(p):
                continue
            if p[0] == 'poly':
                if min(self.depth(x, y) for x, y in p[1]) < NEAR * 0.4:
                    continue
                self.poly([(x, y, 6) for x, y in p[1]], COLS[st],
                          stroke=shade(COLS[st], 0.85), lw=0.7)
            elif p[0] == 'rect':
                _, a, b, c, d, _ = p
                if self.depth((a + c) / 2, (b + d) / 2) < NEAR * 0.6:
                    continue
                self.poly([(a, b, 6), (c, b, 6), (c, d, 6), (a, d, 6)],
                          COLS[st], stroke=shade(COLS[st], 0.85), lw=0.7)
            elif p[0] == 'circle':
                _, cx, cy, r_, _ = p
                if self.depth(cx, cy) < NEAR * 0.6:
                    continue
                pts = [(cx + math.cos(a) * r_, cy + math.sin(a) * r_, 8)
                       for a in np.linspace(0, 2 * math.pi, 26)]
                self.poly(pts, COLS[st], stroke=shade(COLS[st], 0.8), lw=0.7)

    def person(self, x, y, ht=1700):
        """A faint scale figure — an outline, deliberately unrendered."""
        t = self.depth(x, y)
        if t < NEAR:
            return
        px, py0 = self.pt(x, y, 0)
        _, pyh = self.pt(x, y, ht)
        _, pysh = self.pt(x, y, ht * 0.82)
        hh = (pysh - pyh)
        self.o.append(
            f'<g stroke="#8a8072" stroke-width="2" fill="none" opacity="0.55">'
            f'<circle cx="{px:.1f}" cy="{pyh - hh / 2:.1f}" r="{abs(hh) / 2:.1f}"/>'
            f'<line x1="{px:.1f}" y1="{pysh:.1f}" x2="{px:.1f}" y2="{py0 - (py0 - pysh) * 0.45:.1f}"/>'
            f'<line x1="{px:.1f}" y1="{py0 - (py0 - pysh) * 0.45:.1f}" '
            f'x2="{px - 9:.1f}" y2="{py0:.1f}"/>'
            f'<line x1="{px:.1f}" y1="{py0 - (py0 - pysh) * 0.45:.1f}" '
            f'x2="{px + 9:.1f}" y2="{py0:.1f}"/>'
            f'<line x1="{px:.1f}" y1="{pysh + abs(hh) * 0.25:.1f}" '
            f'x2="{px - 11:.1f}" y2="{pysh + abs(hh) * 1.3:.1f}"/>'
            f'<line x1="{px:.1f}" y1="{pysh + abs(hh) * 0.25:.1f}" '
            f'x2="{px + 11:.1f}" y2="{pysh + abs(hh) * 1.3:.1f}"/></g>')

    def save(self, name):
        # a soft vignette, then the frame
        self.o.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="none" '
                      f'stroke="#322819" stroke-opacity="0.15" stroke-width="46"/>')
        self.o.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="none" '
                      f'stroke="#2a2724" stroke-width="4"/>')
        self.o.append('</svg>')
        svg = os.path.join(OUT, name + '.svg')
        open(svg, 'w').write('\n'.join(self.o))
        fitz.open(svg)[0].get_pixmap(matrix=fitz.Matrix(1.35, 1.35)).save(
            os.path.join(OUT, name + '.png'))
        print('view', name)


# ---------------------------------------------------------------- box specs
# kind -> (height, colour, back-band height or None)
KIND_H = {
    'sofa': (430, '#f3ead7', 780), 'recliner': (430, '#f3ead7', 780),
    'sidetable': (500, '#c8a266', None), 'swivel': (450, '#f3ead7', 760),
    'counter': (900, '#e8dcc4', None), 'console': (780, '#b98b52', None),
    'dining': (750, '#d9c39a', None), 'bed': (550, '#f6efe0', 1150),
    'murphy': (550, '#f6efe0', 1300), 'hanging': (2300, '#c8a266', None),
    'shelves': (1300, '#b98b52', None), 'joinery': (2300, '#c8a266', None),
    'appliance': (2000, '#d8d2c4', None), 'bunk': (1450, '#e8dcc4', None),
    'gym': (2150, '#9b958a', None), 'spa': (880, '#cfe0e6', None),
    'plant': (1150, '#8fae76', None), 'planter': (420, '#b5c9a2', None),
    'fountain': (420, '#d7e8ee', None), 'basket': (350, '#c8a266', None),
    'bin': (350, '#b6ab97', None), 'mirror': (1900, '#dfeaf0', None),
    'wc': (420, '#fbf8f1', 800), 'shower': (60, '#d7e2e6', None),
    'sink': (150, '#eef0ee', None), 'hob': (60, '#3a3a3a', None),
    'under': (850, '#d8d2c4', None), 'screen': (2400, '#a97e48', None),
    'tint': (2400, '#dbc394', None), 'counter-b': (900, '#e8dcc4', None),
}


def boxes_in(v, x0, y0, x1, y1, skip=()):
    """Extrude every FURNITURE piece whose bbox centre falls in the window."""
    out = []
    for kind, a, b, c, d, lab in D.FURNITURE:
        cx, cy = (a + c) / 2, (b + d) / 2
        if not (x0 <= cx <= x1 and y0 <= cy <= y1):
            continue
        base = kind.split('-')[0]
        if base in skip or kind in skip or base in ('grass', 'rug'):
            continue
        spec = KIND_H.get(kind) or KIND_H.get(base)
        if not spec:
            continue
        h, col, back = spec
        side = kind.split('-')[1] if '-' in kind and \
            kind.split('-')[1] in 'nsew' else None
        out.append((kind, a, b, c, d, h, col, back, side))
    # far first
    out.sort(key=lambda e: -v.depth((e[1] + e[3]) / 2, (e[2] + e[4]) / 2))
    return out


def draw_boxes(v, entries):
    for kind, a, b, c, d, h, col, back, side in entries:
        if v.depth((a + c) / 2, (b + d) / 2) < NEAR * 1.15:
            continue
        base = kind.split('-')[0]
        if base == 'plant':
            v.tree((a + c) / 2, (b + d) / 2, ht=1500, rr=520, trunk=90)
            continue
        if base == 'shower':
            v.box(a, b, c, d, 60, col, shadow=False)         # the tray
            v.box(a, b, c, d, 2050, col, z0=60, shadow=False)
            continue
        v.box(a, b, c, d, h, col)
        if back and side:
            t = 190
            bb = {'n': (a, b, c, b + t), 's': (a, d - t, c, d),
                  'e': (c - t, b, c, d), 'w': (a, b, a + t, d)}[side]
            v.box(bb[0], bb[1], bb[2], bb[3], back, shade(col, 0.93),
                  z0=0, shadow=False)


def retrofit_boxes(v, fns, ht, col, x0, y0, x1, y1):
    """Extrude a retrofit function's solid footprints to a height."""
    ent = []
    for fn in fns:
        for p in fn:
            if p[-1] not in ('solid', 'wood', 'tint'):
                continue
            if p[0] == 'poly':
                xs = [q[0] for q in p[1]]
                ys = [q[1] for q in p[1]]
            elif p[0] == 'rect':
                xs, ys = [p[1], p[3]], [p[2], p[4]]
            else:
                continue
            a, b, c, d = min(xs), min(ys), max(xs), max(ys)
            cx, cy = (a + c) / 2, (b + d) / 2
            if not (x0 <= cx <= x1 and y0 <= cy <= y1):
                continue
            if (c - a) < 60 or (d - b) < 60:
                continue
            ent.append((a, b, c, d))
    ent.sort(key=lambda e: -v.depth((e[0] + e[2]) / 2, (e[1] + e[3]) / 2))
    for a, b, c, d in ent:
        v.box(a, b, c, d, ht, col)


# ======================================================================
#  the views
# ======================================================================

def great_room_north(name):
    """Standing under the gallery arch, looking north over the seating to
    the deck, the fountain and the parapet planting."""
    v = View(12240, 7650, '-y', 'GREAT ROOM — LOOKING NORTH')
    v.backdrop()
    # the deck is drawn FIRST, real furniture and all, then the glass skin
    # goes over it — so the recliners and the fountain read through the glass
    v.floor(8400, -150, 16100, 7800, 'oak', boards='y')
    v.box(8400, -150, 16100, 190, 450, '#9db884', shadow=False)  # parapet bed
    draw_boxes(v, boxes_in(v, 8500, -150, 16000, 2540))          # deck pieces
    v.wall(8400, 2620, 9115, 2620, 'wall')          # west void face
    v.wall(15365, 2620, 16100, 2620, 'wall')        # east void face
    v.wall(9115, 2545, 15365, 2545, 'glasskin')
    v.flat(R.great_room_rug())
    v.screen_bezier(D.POD_W, D.POD_PORTAL_W, D.KIT_N)
    v.screen_bezier(D.POD_E, D.POD_PORTAL_E, D.BODY_S, dado=900)
    v.ceiling(8400, 2620, 16100, 7800,
              spots=[(10500, 4200), (12240, 3300), (14000, 4200),
                     (10500, 6200), (14000, 6200)])
    retrofit_boxes(v, [R.great_room_planter()], 900, '#b5c9a2',
                   8400, 2600, 16100, 7800)
    retrofit_boxes(v, [R.great_room_sofa()], 620, '#f3ead7',
                   8400, 2600, 16100, 7800)
    retrofit_boxes(v, [R.rocking_chair(13080, 3500,
                                       face=(10123 - 13080, 3932 - 3500)),
                       R.armchair(13800, 5050, (11640 - 13800, 4400 - 5050))],
                   700, '#f3ead7', 8400, 2600, 16100, 7800)
    draw_boxes(v, boxes_in(v, 8400, 2600, 16100, 7700))
    v.tree(10123, 5087, ht=2400, rr=780)     # the tree out of the sofa's end
    v.glow(12240, 1160, 900, 1000, '#fff3c9')
    v.person(14400, 6600)
    v.save(name)


def great_room_south(name):
    """From the deck glass looking south — the console, the apse, its two
    sconces and the arched door into the gallery."""
    v = View(12240, 2900, '+y', 'GREAT ROOM — LOOKING SOUTH TO THE APSE')
    v.backdrop()
    v.floor(8400, 2600, 16100, 8600, 'oak', boards='y')
    v.flat(R.great_room_rug())
    # the apse wall with the arch on the axis
    v.wall(10400, 7700, 11640, 7700, 'wall')
    v.wall(12840, 7700, 14080, 7700, 'wall')
    v.wall(11640, 7700, 12840, 7700, 'wall', openings=[(90, 1110, 'arch')])
    v.wall(8400, 8000, 10400, 8000, 'side')
    v.wall(14080, 8000, 16100, 8000, 'side')
    v.screen_bezier(D.POD_W, D.POD_PORTAL_W, D.KIT_N)
    v.screen_bezier(D.POD_E, D.POD_PORTAL_E, D.BODY_S, dado=900)
    v.ceiling(8400, 2600, 16100, 8600,
              spots=[(10500, 4600), (13900, 4600), (12240, 6500)])
    retrofit_boxes(v, [R.great_room_planter()], 900, '#b5c9a2',
                   8400, 2600, 16100, 8000)
    retrofit_boxes(v, [R.great_room_sofa()], 620, '#f3ead7',
                   8400, 2600, 16100, 8000)
    retrofit_boxes(v, [R.rocking_chair(13080, 3500,
                                       face=(10123 - 13080, 3932 - 3500)),
                       R.armchair(13800, 5050, (11640 - 13800, 4400 - 5050))],
                   700, '#f3ead7', 8400, 2600, 16100, 8000)
    v.tree(10123, 5087, ht=2400, rr=780)
    draw_boxes(v, boxes_in(v, 8400, 3000, 16100, 8000))
    v.glow(11200, 7650, 1900, 620)          # the two apse sconces
    v.glow(13280, 7650, 1900, 620)
    v.glow(11150, 5700, 1500, 520)          # the console lamp
    v.person(13500, 3600)
    v.save(name)


def deck_along(name):
    """On the deck itself, at the west end, looking east down its length —
    recliners on the voids, the fountain, the spa far off."""
    v = View(8000, 1500, '+x', 'ALL-WEATHER DECK — LOOKING EAST')
    v.backdrop()
    v.floor(8000, -150, 20000, 2620, 'oak', boards='y')
    v.flat(R.terrace_pieces())
    v.wall(8000, -150, 20000, -150, 'glass')        # the parapet line: sky
    v.wall(8000, 2545, 20000, 2545, 'glass')        # the great room behind
    v.ceiling(8000, -150, 20000, 2620,
              spots=[(9500, 1200), (12240, 1200), (15000, 1200), (17500, 1200)])
    draw_boxes(v, boxes_in(v, 8100, -150, 19900, 2620))
    v.glow(12240, 1160, 500, 1000, '#fff3c9')
    v.person(13400, 2000)
    v.save(name)


def suite_view(name, mir=False):
    """Standing at a master suite's sliding partition, looking west (parents)
    or east (Karan) over the bed to the terrace glass and its tree."""
    M = (lambda x: 2 * 12240 - x) if mir else (lambda x: x)
    axis = '+x' if mir else '-x'
    v = View(M(4300), 4300, axis,
             'MASTER SUITE — TO THE BED AND THE TERRACE')
    v.backdrop()
    x0, x1 = (M(4500), M(-600)) if mir else (-600, 4500)
    lo, hi = min(x0, x1), max(x0, x1)
    v.floor(lo, 1950, hi, 5900, 'oak', boards='x')
    v.wall(M(-600), 1950, M(-600), 5900, 'wall',
           openings=[(650, 2650, 'window')])
    v.wall(M(-600), 1950, M(4500), 1950, 'glass')   # terrace beyond: green
    v.wall(M(-600), 5900, M(4500), 5900, 'side')
    v.ceiling(lo, 1950, hi, 5900,
              spots=[(M(1200), 3000), (M(2800), 3000), (M(1200), 5000)])
    draw_boxes(v, boxes_in(v, lo, 1900, hi, 5950))
    v.tree(M(1200), 600, ht=2500, rr=850)           # the terrace tree, beyond
    v.person(M(3600), 5300)
    v.save(name)


def dressing_view(name):
    """The parents' dressing zone: the wall bed folded down, the sliding
    cupboards, the tinted screen shut behind."""
    v = View(2350, 7150, '-x', 'PARENTS’ DRESSING — WALL BED DOWN')
    v.backdrop()
    v.floor(-600, 5995, 2750, 8945, 'oak', boards='x')
    v.wall(-600, 5995, -600, 8945, 'wall', openings=[(2050, 2950, 'window')])
    v.wall(-600, 8945, 2750, 8945, 'side')
    v.wall(-600, 5995, 2750, 5995, 'side',
           openings=[(1850, 3182, 'open')])          # the tinted-glass slider
    v.ceiling(-600, 5995, 2750, 8945, spots=[(700, 7000), (700, 8300)])
    draw_boxes(v, boxes_in(v, -600, 5990, 2760, 8950))
    v.person(1900, 8500)
    v.save(name)


def den_view(name):
    """Karan's music + work den, from the portal: the long work console on
    the screen, the e-kit in the corner, the two recliners."""
    v = View(15900, 4700, '+x', 'MUSIC + WORK DEN')
    v.backdrop()
    v.floor(15800, 2620, 20600, 8400, 'oak', boards='x')
    v.wall(20600, 2620, 20600, 8400, 'wall')
    v.wall(15800, 2620, 20600, 2620, 'glass')      # the deck light, north
    v.wall(15800, 8400, 20600, 8400, 'side')
    v.ceiling(15800, 2620, 20600, 8400,
              spots=[(17500, 4000), (19200, 4000), (17500, 6500),
                     (19200, 6500)])
    retrofit_boxes(v, [R.drum_kit()], 750, '#d8d2c4',
                   15800, 2620, 20600, 8400)
    retrofit_boxes(v, [R.corner_units()], 750, '#c8a266',
                   15800, 2620, 20600, 8400)
    draw_boxes(v, boxes_in(v, 15810, 2620, 20590, 8390))
    v.person(19800, 7600)
    v.save(name)


def family_view(name):
    """The family room: the six-seat table, the serving hatch to the
    kitchen, the west pod's glass with the great room beyond."""
    v = View(6550, 3300, '+y', 'FAMILY ROOM — THE TABLE AND THE HATCH')
    v.backdrop()
    v.floor(3700, 2620, 8400, 8400, 'oak', boards='x')
    v.wall(3700, 8400, 8400, 8400, 'wall',
           openings=[(3200, 4300, 'warm')])          # the serving hatch, lit
    v.wall(3700, 2620, 3700, 8400, 'side')
    v.wall(8400, 2620, 8400, 8400, 'side')
    v.ceiling(3700, 2620, 8400, 8400,
              spots=[(6000, 4500), (6000, 6500), (4800, 5500), (7200, 5500)])
    retrofit_boxes(v, [R.corner_units()], 750, '#c8a266',
                   3700, 2620, 8400, 8400)
    draw_boxes(v, boxes_in(v, 3710, 2620, 8390, 8390))
    v.person(4500, 4000)
    v.save(name)


def kitchen_view(name):
    """Down the kitchen's working run: counters both sides, the hob and its
    45 of clearance, the magic corner."""
    v = View(8400, 8300, '+y', 'KITCHEN — THE WORKING RUN')
    v.backdrop()
    v.floor(6900, 7800, 9800, 11200, 'stone')
    v.wall(6900, 11200, 9800, 11200, 'wall')
    v.wall(6900, 7800, 6900, 11200, 'side', openings=[(700, 1800, 'window')])
    v.wall(9800, 7800, 9800, 11200, 'side')
    v.ceiling(6900, 7800, 9800, 11200, spots=[(8300, 9200), (8300, 10400)])
    retrofit_boxes(v, [R.kitchen_counter(), R.hob_counter(),
                       R.magic_corner()], 900, '#e8dcc4',
                   6900, 7800, 9800, 11200)
    draw_boxes(v, boxes_in(v, 6910, 7810, 9790, 11190, skip=('sink', 'hob')))
    v.person(7600, 10700)
    v.save(name)


def gallery_view(name):
    """Standing just inside the front doors: the U of the entry gallery,
    the console and mirror, the two chairs, the arch ahead into the great
    room with its sconces lit."""
    v = View(12240, 11050, '-y', 'ENTRY GALLERY — FROM THE FRONT DOOR')
    v.backdrop()
    v.floor(10300, 7500, 14180, 11200, 'stone')
    v.wall(10400, 7600, 11640, 7600, 'wall')
    v.wall(12840, 7600, 14080, 7600, 'wall')
    v.wall(11640, 7600, 12840, 7600, 'wall', openings=[(90, 1110, 'arch')])
    v.wall(10400, 7600, 10400, 11200, 'wood')
    v.wall(14080, 7600, 14080, 11200, 'wood')
    v.ceiling(10300, 7500, 14180, 11200, spots=[(12240, 9300), (12240, 10400)])
    draw_boxes(v, boxes_in(v, 10310, 7610, 14170, 11190))
    v.glow(11200, 7650, 1900, 620)
    v.glow(13280, 7650, 1900, 620)
    v.person(11500, 8600)
    v.save(name)


def bath_view(name):
    """The parents' bath: the arched sweep, the curved vanity, the shower
    behind glass."""
    v = View(4900, 8000, '-x', 'MASTER BATH — VANITY AND SHOWER')
    v.backdrop()
    v.floor(3300, 6600, 5300, 9500, 'stone')
    v.wall(3300, 6600, 3300, 9500, 'wall')
    v.wall(3300, 6600, 5300, 6600, 'side')
    v.wall(3300, 9500, 5300, 9500, 'side', openings=[(400, 1300, 'window')])
    v.ceiling(3300, 6600, 5300, 9500, spots=[(4200, 7500), (4200, 8700)])
    retrofit_boxes(v, [R.mb_console(), R.mb_cabinet(), R.mb_shelves()],
                   850, '#e8dcc4', 3300, 6600, 5300, 9500)
    draw_boxes(v, boxes_in(v, 3310, 6610, 5290, 9490))
    v.glow(4000, 6900, 1800, 500)
    v.save(name)


def terrace_view(name):
    """Karan's terrace through the suite: grass underfoot, the tree, the
    jhoola, the parapet planting and open sky."""
    v = View(22330, 2300, '-y', 'TERRACE — GRASS, TREE AND JHOOLA')
    v.backdrop()
    v.floor(21730, -150, 25080, 1200, 'green')
    v.flat(R.terrace_pieces(), keep=lambda p: True)
    v.wall(21730, -150, 25080, -150, 'glass')       # the parapet: open sky
    v.wall(21730, -150, 21730, 1200, 'side')
    v.wall(25080, -150, 25080, 1200, 'side')
    draw_boxes(v, boxes_in(v, 21740, -150, 25070, 1250))
    v.tree(23405, 600, ht=2600, rr=900)
    v.save(name)



def great_room_east(name):
    """From beside the west pod's portal, looking east across the whole
    seating group to Karan's screen."""
    v = View(9200, 5300, '+x', 'GREAT ROOM — ACROSS THE SEATING')
    v.backdrop()
    v.floor(9200, 2620, 16100, 8000, 'oak', boards='y')
    v.flat(R.great_room_rug())
    v.wall(9115, 2545, 15365, 2545, 'glasskin')
    v.screen_bezier(D.POD_E, D.POD_PORTAL_E, D.BODY_S, dado=900)
    v.wall(10400, 7700, 14080, 7700, 'wall', openings=[(1240, 2440, 'arch')])
    v.ceiling(9200, 2620, 16100, 8000,
              spots=[(10500, 4200), (12240, 3300), (14000, 4200),
                     (12240, 6500)])
    retrofit_boxes(v, [R.great_room_planter()], 900, '#b5c9a2',
                   9200, 2600, 16100, 8000)
    retrofit_boxes(v, [R.great_room_sofa()], 620, '#f3ead7',
                   9200, 2600, 16100, 8000)
    retrofit_boxes(v, [R.rocking_chair(13080, 3500,
                                       face=(10123 - 13080, 3932 - 3500)),
                       R.armchair(13800, 5050, (11640 - 13800, 4400 - 5050))],
                   700, '#f3ead7', 9200, 2600, 16100, 8000)
    draw_boxes(v, boxes_in(v, 9200, 2600, 16100, 7700))
    v.glow(11150, 5700, 1500, 520)
    v.person(14800, 6300)
    v.save(name)


def deck_west(name):
    """The deck again, from the east end by the spa, looking west past the
    fountain to the gym and the far shaft wall."""
    v = View(19300, 1350, '-x', 'ALL-WEATHER DECK — FROM THE SPA END')
    v.backdrop()
    v.floor(4600, -150, 19300, 2620, 'oak', boards='y')
    v.flat(R.terrace_pieces())
    v.wall(4600, -150, 19300, -150, 'glass')
    v.wall(4600, 2545, 19300, 2545, 'glasskin')
    v.ceiling(4600, -150, 19300, 2620,
              spots=[(17500, 1200), (15000, 1200), (12240, 1200),
                     (9500, 1200), (6800, 1200)])
    draw_boxes(v, boxes_in(v, 4700, -150, 19200, 2620))
    v.glow(12240, 1160, 500, 1000, '#fff3c9')
    v.person(16200, 1900)
    v.save(name)


def suite_from_terrace(name):
    """Standing on the parents' terrace itself, on the grass, looking south
    through the open sliders into the suite."""
    v = View(1200, 250, '+y', 'MASTER SUITE — FROM THE TERRACE GRASS')
    v.backdrop()
    v.floor(-350, 250, 2750, 1200, 'green')
    v.floor(-600, 1950, 4500, 5900, 'oak', boards='x')
    v.wall(-600, 1950, 4500, 1950, 'glasskin')     # the sliders, open season
    v.wall(-600, 1950, -600, 5900, 'side')
    v.wall(4500, 1950, 4500, 5900, 'side')
    v.wall(-600, 5900, 4500, 5900, 'wall')
    v.ceiling(-600, 1950, 4500, 5900,
              spots=[(1200, 3000), (2800, 3000), (2000, 5000)])
    draw_boxes(v, boxes_in(v, -600, 1900, 4500, 5950))
    v.person(3400, 4600)
    v.save(name)


def den_from_glass(name):
    """Inside the den at the deck glass, looking south — the recliners in
    the foreground, the work console down the room, the drums far."""
    v = View(18400, 2750, '+y', 'MUSIC + WORK DEN — LOOKING IN')
    v.backdrop()
    v.floor(15800, 2750, 20600, 8400, 'oak', boards='x')
    v.wall(15800, 8400, 20600, 8400, 'wall')
    v.wall(20600, 2620, 20600, 8400, 'side')
    v.screen_bezier(D.POD_E, D.POD_PORTAL_E, D.BODY_S, dado=900)
    v.ceiling(15800, 2750, 20600, 8400,
              spots=[(17500, 4000), (19200, 4000), (17500, 6500),
                     (19200, 6500)])
    retrofit_boxes(v, [R.drum_kit()], 750, '#d8d2c4',
                   15800, 2750, 20600, 8400)
    retrofit_boxes(v, [R.corner_units()], 750, '#c8a266',
                   15800, 2750, 20600, 8400)
    draw_boxes(v, boxes_in(v, 15810, 2750, 20590, 8390))
    v.person(16800, 6800)
    v.save(name)


VIEWS = [
    ('view-great-north', great_room_north),
    ('view-great-south', great_room_south),
    ('view-deck', deck_along),
    ('view-suite-parents', lambda n: suite_view(n, mir=False)),
    ('view-suite-karan', lambda n: suite_view(n, mir=True)),
    ('view-dressing', dressing_view),
    ('view-den', den_view),
    ('view-family', family_view),
    ('view-kitchen', kitchen_view),
    ('view-gallery', gallery_view),
    ('view-bath', bath_view),
    ('view-terrace', terrace_view),
    ('view-great-east', great_room_east),
    ('view-deck-west', deck_west),
    ('view-suite-terrace', suite_from_terrace),
    ('view-den-in', den_from_glass),
]

if __name__ == '__main__':
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for nm, fn in VIEWS:
        if only and only not in nm:
            continue
        fn(nm)
