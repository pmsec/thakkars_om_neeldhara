"""
Home 1's printable plan with every space and every significant piece sized in
FEET AND INCHES only — length x width x height — and nothing in any other unit.

    FEET_DUMP=/tmp/home1-dump.json npx vite-node docs/feet-plan/dump.ts
    python3 docs/feet-plan/feet_plan.py --cad <CAD/tools> --dump /tmp/home1-dump.json --out <dir>
    node docs/feet-plan/print_pdf.mjs <dir>/home1-feet-plan.svg <dir>/home1-feet-plan-A1.pdf

The drawing is the CAD sheet itself (draw_design.main), captured before it is
saved: the same walls, glass, joinery and furniture outlines. Its own text is
taken off wholesale — room areas in m2, dimension chains in mm, the title and
the keep-clear sizes — and so are the lobby beyond the flat and the chains.
What goes back on is only this script's labels, every one in feet and inches.

Spaces come from the app's derived room polygons (every face of the plan,
ducts and shafts included), furniture and fixtures from the app's exported
lists, so the print and the walkthrough cannot disagree.
"""

import argparse
import json
import math
import os
import re
import sys

import numpy as np

# ---------------------------------------------------------------- units
def ftin(mm):
    """Feet and inches, to the nearest inch: 13'-7\"."""
    inches = int(round(mm / 25.4))
    return f"{inches // 12}'-{inches % 12}\""


def lwh(L, W, H):
    return f'{ftin(L)} × {ftin(W)} × {H if isinstance(H, str) else ftin(H)}'


# ------------------------------------------------------------ geometry
def area(p):
    return abs(sum(p[i][0] * p[i - 1][1] - p[i - 1][0] * p[i][1] for i in range(len(p)))) / 2


def perim(p):
    return sum(math.dist(p[i], p[i - 1]) for i in range(len(p)))


def inside(pt, poly):
    x, y = pt
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            c = not c
        j = i
    return c


def edge_dist(pts, poly):
    """Distance from each of pts (N x 2) to the polygon's boundary."""
    P = np.asarray(poly, float)
    A, B = P, np.roll(P, -1, axis=0)
    Q = np.asarray(pts, float)[:, None, :]
    AB = B - A
    L2 = (AB ** 2).sum(1)
    L2[L2 == 0] = 1
    t = np.clip(((Q - A) * AB).sum(2) / L2, 0, 1)
    C = A + t[..., None] * AB
    return np.sqrt(((Q - C) ** 2).sum(2)).min(1)


def strip_dims(poly):
    """A run's length and depth, read as the strip with the same area and
    perimeter: exact for a rectangle, the run along the curve for a curved
    console, the total run for an L-shaped counter."""
    A, P = area(poly), perim(poly)
    s = P / 2
    disc = s * s - 4 * A
    if disc < 0:
        return None
    L = (s + math.sqrt(disc)) / 2
    return L, A / L


def bbox(poly):
    xs = [q[0] for q in poly]
    ys = [q[1] for q in poly]
    return min(xs), min(ys), max(xs), max(ys)


# -------------------------------------------------------------- naming
ROOM_NAMES = {
    'R-P-TERRACE': "PARENTS' TERRACE", 'R-K-TERRACE': "KARAN'S TERRACE",
    'R-DECK': 'ALL-WEATHER DECK', 'R-SHAFT-W': 'SEALED SHAFT', 'R-SHAFT-E': 'SEALED SHAFT',
    'R-VOID-W': 'VOID STORE', 'R-VOID-E': 'VOID STORE',
    'R-P-SUITE': "PARENTS' MASTER SUITE", 'R-P-DRESSING': "GRANDMOTHER'S ROOM",
    'R-P-BATH': "PARENTS' BATH", 'R-G-BATH': "GRANDMOTHER'S BATH",
    'R-K-SUITE': "KARAN'S MASTER SUITE", 'R-K-BATH': "KARAN'S BATH",
    'R-P-FAMILY': 'FAMILY ROOM + DINING', 'R-K-DEN': 'MUSIC + WORK DEN',
    'R-GREAT': 'GREAT ROOM', 'R-DUCT-WM': 'MAIN SERVICE DUCT', 'R-DUCT-W': 'SECONDARY DUCT',
    'R-DEAD-W': 'DEAD SLAB', 'R-DUCT-E': 'MAIN SERVICE DUCT', 'R-DUCT-SE': 'SECONDARY DUCT / RISER',
    'R-KITCHEN': 'KITCHEN + UTILITY', 'R-ENTRY': 'ENTRY GALLERY', 'R-HELP': "HELP'S ROOM",
    'R-GUEST-BATH': 'GUEST WC', 'R-WC-PASS': 'WC PASSAGE',
}
SHAFTS = {'R-SHAFT-W', 'R-SHAFT-E', 'R-DUCT-WM', 'R-DUCT-W', 'R-DUCT-E', 'R-DUCT-SE'}
OUTDOOR_H = "11'-6\" to 20'-0\""          # under the glass vault: pod line to its crown


def piece_name(f):
    lab = f.get('label') or ''
    k = f['kind']
    low = lab.lower()
    for key, name in (('headboard', 'HEADBOARD'), ('wall bed', 'WALL BED CABINET'),
                      ('crockery', 'CROCKERY CLOSET'), ('mandir', 'MANDIR'),
                      ('pod screen console', 'CONSOLE'), ('arch console', 'ARCH CONSOLE'),
                      ('recliner sofa', 'RECLINER SOFA'),
                      ('arch planter', 'ARCH PLANTER'), ('great-room planter', 'PLANTER'),
                      ('planter box', 'PLANTER BOX'), ('corner unit', 'PANTRY UNIT'),
                      ('strength trainer', 'GYM'), ('spa', 'SPA'), ('dresser', 'DRESSER'),
                      ('low wooden table', 'LOW TABLE'), ('full-height rack', 'TALL RACK'),
                      ('aluminium rack', 'RACK'), ('loft', 'LOFT OVER'),
                      ('shelves at the bunk', 'SHELVES'), ('bunk', 'BUNK BED'),
                      ('recliner sofa', 'RECLINER SOFA'),
                      ('2-seat recliner', '2-SEAT RECLINER'), ('recliner', 'RECLINER'),
                      ('2-seat sofa', 'SOFA'), ('single sofa', 'ARMCHAIR'),
                      ('rocking', 'ROCKING CHAIR'), ('jhoola', 'JHOOLA'),
                      ('counter run', 'KITCHEN COUNTER'), ('curved vanity', 'VANITY'),
                      ('curved console', 'VANITY'), ('bath wall cabinet', 'BATH CABINET'),
                      ('bath shelves', 'BATH SHELVES'), ('tall fridge', 'FRIDGE'),
                      ('washer and dryer', 'WASHER + DRYER'), ('wardrobe', 'WARDROBE'),
                      ('console', 'CONSOLE')):
        if key in low:
            return name
    return {'bed': 'BED', 'dining': 'DINING TABLE', 'wardrobe': 'WARDROBE',
            'console': 'CONSOLE', 'sofa': 'SOFA'}.get(k, k.upper())


# the pieces that get a label, and the heights the fixtures are built to
FURN_KINDS = {'bed', 'wardrobe', 'console', 'sofa', 'dining', 'lounger', 'shelves',
              'planter', 'bench', 'table', 'armchair'}
SKIP_LABEL = ('side table', 'bin', 'planted strip', 'desk chair', 'chair', 'clothes dryer')
FIX_H = {'counter': 940, 'basin': 890, 'fridge': 1900, 'laundry': 1800}
STRIP = {'console', 'wardrobe', 'shelves', 'planter', 'counter', 'basin'}
# kept off room labels' floor: everything except what lies on the floor or overhead
FLOOR_OR_OVERHEAD = ('rug', 'grass', 'loft', 'planted strip', 'clothes dryer')


def outline(f):
    if f.get('poly'):
        return [(q['x'], q['y']) for q in f['poly']]
    if 'at' in f:
        w, d = f['size']
        x, y = f['at']['x'], f['at']['y']
        return [(x - w / 2, y - d / 2), (x + w / 2, y - d / 2), (x + w / 2, y + d / 2), (x - w / 2, y + d / 2)]
    return [(f['x'], f['y']), (f['x'] + f['w'], f['y']), (f['x'] + f['w'], f['y'] + f['d']), (f['x'], f['y'] + f['d'])]


def piece_dims(f, poly):
    x0, y0, x1, y1 = bbox(poly)
    L, W = max(x1 - x0, y1 - y0), min(x1 - x0, y1 - y0)
    kind = f['kind']
    # a loft is its room's shape, overhead: its box is its size, not a strip
    if f.get('poly') and kind in STRIP and 'loft' not in (f.get('label') or '').lower():
        sd = strip_dims(poly)
        if sd and sd[1] < W * 0.95:                  # a curved, angled or L-shaped run:
            L, W = sd                                # its box overstates its depth
    H = f.get('height') or FIX_H.get(kind, 0)
    return L, W, H


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cad', required=True)
    ap.add_argument('--dump', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    sys.path.insert(0, a.cad)
    os.chdir(a.cad)
    import draw_design as DD

    data = json.load(open(a.dump))
    CEIL = data['ceiling']

    # the sheet, framed on the home (no lobby, no title strip), same line weights
    captured = []
    base_init = DD.Sheet.__init__
    FRAME = (-900, -700, 25900, 12100)
    sc0 = (4200 - 180) / (26600 + 3200)

    def init(self, *_a, **_k):
        base_init(self, *FRAME, width=int((FRAME[2] - FRAME[0]) * sc0) + 180)
    DD.Sheet.__init__ = init
    DD.Sheet.save = lambda self, name: captured.append(self)
    DD.main()
    s = captured[0]

    # strip the sheet's own words: whole layers, then any text left anywhere
    drop = {'<g id="L-labels">', '<g id="L-dims">', '<g id="L-title">', '<g id="L-ref">'}
    body, skipping = [], False
    for item in s.o:
        if item in drop:
            skipping = True
            continue
        if skipping:
            if item == '</g>':
                skipping = False
            continue
        # (a <text data-keep="1"> is the sheet's own minimal note — the
        # reclaimed ducts' — and stays)
        item = re.sub(r'<text\b(?![^>]*data-keep)[^>]*>.*?</text>', '', item, flags=re.S)
        body.append(item)
    s.o = body

    px_mm = s.sc                                    # sheet px per model mm
    placed = []                                     # label boxes already on the sheet (model mm)
    # the sheet's own kept notes are labels already down: nothing lands on them
    for m in re.finditer(r'<text x="([-\d.]+)" y="([-\d.]+)" font-size="([\d.]+)"[^>]*data-keep="1"[^>]*>([^<]*)</text>',
                         ''.join(body)):
        kx, ky, fs, txt = float(m[1]), float(m[2]), float(m[3]), m[4]
        kw, kh = len(txt) * fs * 0.66 / px_mm, fs * 1.3 / px_mm
        cx, cy = (kx - s.pad) / s.sc + s.x0, (ky - fs * 0.35 - s.pad) / s.sc + s.y0
        placed.append((cx - kw / 2, cy - kh / 2, cx + kw / 2, cy + kh / 2))
    kept_polys = [[(a, b), (c, b), (c, d), (a, d)] for a, b, c, d in placed]

    def text_w(txt, size):
        return len(txt) * size * 0.56 / px_mm      # model mm

    def overlaps(box, m=70.0):
        # (with a 70 margin: the widths are estimates, and two labels that
        # only just miss on paper read as one)
        x0, y0, x1, y1 = box[0] - m, box[1] - m, box[2] + m, box[3] + m
        return any(not (x1 < b[0] or b[2] < x0 or y1 < b[1] or b[3] < y0) for b in placed)

    def emit(cx, cy, lines, rot=False):
        """lines: [(text, size, weight, colour)] centred on (cx, cy)."""
        H = sum(sz for _, sz, _, _ in lines) * 1.18
        W = max(len(t) * sz * 0.56 for t, sz, _, _ in lines)
        tr = f' transform="rotate(-90 {s.X(cx):.1f} {s.Y(cy):.1f})"' if rot else ''
        y = s.Y(cy) - H / 2
        s.o.append(f'<g{tr}>')
        for t, sz, wt, col in lines:
            y += sz * 1.18
            # a paper-coloured halo UNDER the words, as its own element: every
            # viewer draws it, where paint-order is not universally honoured
            common = (f'x="{s.X(cx):.1f}" y="{y - sz * 0.25:.1f}" font-size="{sz}" '
                      f'font-weight="{wt}" text-anchor="middle" '
                      f'font-family="Helvetica,Arial,sans-serif"')
            s.o.append(f'<text {common} fill="#faf8f4" stroke="#faf8f4" stroke-width="3.2" '
                       f'stroke-linejoin="round">{DD.esc(t)}</text>')
            s.o.append(f'<text {common} fill="{col}">{DD.esc(t)}</text>')
        s.o.append('</g>')
        hw, hh = (H / 2) / px_mm, (W / 2) / px_mm
        if not rot:
            hw, hh = hh, hw
        placed.append((cx - hw, cy - hh, cx + hw, cy + hh))

    # --------------------------------------------------- pieces first
    pieces = []
    for f in data['furniture']:
        lab = (f.get('label') or '').lower()
        if f['kind'] not in FURN_KINDS or any(k in lab for k in SKIP_LABEL) and 'recliner' not in lab:
            continue
        if f['kind'] == 'table' and 'spa' not in lab:
            continue
        pieces.append(f)
    for f in data['fixtures']:
        lab = (f.get('label') or '').lower()
        if f['kind'] in ('counter', 'fridge', 'laundry') or (f['kind'] == 'basin' and f.get('poly')):
            pieces.append(f)
    # a loft that is its whole room's outline says nothing the room's own label
    # does not: only the lofts over a part of a room (the kitchen's strip) stay
    room_poly = {r['id']: [(q['x'], q['y']) for q in r['polygon']] for r in data['rooms']}
    def whole_room_loft(f):
        if 'loft' not in (f.get('label') or '').lower() or f['room'] not in room_poly:
            return False
        # (0.7, not more: the room polygon runs to the wall centrelines and a
        # 770 passage's loft is only 78% of it)
        return area(outline(f)) > 0.7 * area(room_poly[f['room']])
    pieces = [f for f in pieces if not whole_room_loft(f)]

    # small pieces choose first — they have the fewest places to go — and the
    # big overhead lofts last, since they overlie what is under them
    def order_key(f):
        is_loft = 'loft' in (f.get('label') or '').lower()
        return (is_loft, area(outline(f)))
    pieces.sort(key=order_key)
    all_outlines = [outline(f) for f in pieces]

    FS_N, FS_D = 13, 14
    for f in pieces:
        poly = outline(f)
        L, W, H = piece_dims(f, poly)
        name, dims = piece_name(f), lwh(L, W, H)
        x0, y0, x1, y1 = bbox(poly)
        rot = (y1 - y0) > (x1 - x0) * 1.25 and (x1 - x0) < 900
        span_w = max(text_w(name, FS_N), text_w(dims, FS_D))
        span_h = (FS_N + FS_D) * 1.18 / px_mm
        # candidates inside the outline, deepest first, clear of labels already down
        xs = np.arange(x0 + 20, x1 - 19, 25.0)
        ys = np.arange(y0 + 20, y1 - 19, 25.0)
        if not len(xs) or not len(ys):
            xs, ys = np.array([(x0 + x1) / 2]), np.array([(y0 + y1) / 2])
        G = np.array([(x, y) for x in xs for y in ys])
        G = G[[inside(tuple(p), poly) for p in G]] if len(G) else G
        if not len(G):
            G = np.array([((x0 + x1) / 2, (y0 + y1) / 2)])
        order = np.argsort(-edge_dist(G, poly))
        hw, hh = (span_h / 2, span_w / 2) if rot else (span_w / 2, span_h / 2)
        best = None
        for i in order[:600]:
            cx, cy = G[i]
            if not overlaps((cx - hw, cy - hh, cx + hw, cy + hh)):
                best = (cx, cy)
                break
        if best is None:
            # no room inside it: the nearest spot just outside, clear of every
            # label already down and not sitting on another labelled piece
            c0 = G[order[0]]
            ring = sorted(((c0[0] + dx, c0[1] + dy) for dx in np.arange(-1600, 1601, 50.0)
                           for dy in np.arange(-1600, 1601, 50.0)),
                          key=lambda q: math.dist(q, c0))
            for cx, cy in ring:
                if overlaps((cx - hw, cy - hh, cx + hw, cy + hh)):
                    continue
                if any(inside((cx, cy), o) for o in all_outlines if o is not poly):
                    continue
                best = (cx, cy)
                break
        if best is None:
            best = G[order[0]]
        emit(best[0], best[1], [(name, FS_N, 'bold', '#5b4a36'), (dims, FS_D, 'normal', '#1f1d1a')], rot)

    # ------------------------------------------------------ then the spaces
    obstacles = []
    for f in data['furniture'] + data['fixtures']:
        lab = (f.get('label') or '').lower()
        if f['kind'] in ('rug', 'grass', 'shower', 'grab', 'rail', 'tree', 'screen') or any(k in lab for k in FLOOR_OR_OVERHEAD):
            continue
        obstacles.append(outline(f))
    obstacles += kept_polys                         # ...and the sheet's kept notes

    def free(cx, cy, hw, hh, poly, use_obst):
        pts = [(cx + dx * hw, cy + dy * hh) for dx in (-1, -0.5, 0, 0.5, 1) for dy in (-1, 0, 1)]
        if not all(inside(p, poly) for p in pts):
            return False
        if overlaps((cx - hw, cy - hh, cx + hw, cy + hh)):
            return False
        if use_obst:
            for ob in obstacles:
                ox0, oy0, ox1, oy1 = bbox(ob)
                if ox1 < cx - hw or cx + hw < ox0 or oy1 < cy - hh or cy + hh < oy0:
                    continue
                if any(inside(p, ob) for p in pts):
                    return False
        return True

    rooms = sorted(data['rooms'], key=lambda r: -area([(q['x'], q['y']) for q in r['polygon']]))
    for r in rooms:
        poly = [(q['x'], q['y']) for q in r['polygon']]
        x0, y0, x1, y1 = bbox(poly)
        L, W = max(x1 - x0, y1 - y0), min(x1 - x0, y1 - y0)
        rid = r['id']
        name = ROOM_NAMES.get(rid, r['name'].upper())
        if rid in SHAFTS:
            dims = f'{ftin(L)} × {ftin(W)} · open shaft'
        elif r['category'] == 'outdoor':
            dims = lwh(L, W, OUTDOOR_H)
        else:
            dims = lwh(L, W, CEIL)
        # size to the room: as large as fits, never below legible
        fn, fd = 24, 19
        while fn > 13 and max(text_w(name, fn), text_w(dims, fd)) > 0.92 * (x1 - x0):
            fn -= 1
            fd = max(12, fd - 1)
        G = np.array([(x, y) for x in np.arange(x0, x1, 60.0) for y in np.arange(y0, y1, 60.0)])
        G = G[[inside(tuple(p), poly) for p in G]]
        if not len(G):
            continue
        order = np.argsort(-edge_dist(G, poly))
        spot = None
        while True:
            # (a room's box is wider than its usable inside where a curved
            # wall bulges into it — the WC passage — so when nothing fits at
            # this size, shrink a step and look again, down to legible)
            lines = [(name, fn, 'bold', '#1f1d1a'), (dims, fd, 'normal', '#2c5c61')]
            hw = max(text_w(name, fn), text_w(dims, fd)) / 2
            hh = (fn + fd) * 1.18 / px_mm / 2
            for use_obst in (True, False):
                for i in order:
                    cx, cy = G[i]
                    if free(cx, cy, hw, hh, poly, use_obst):
                        spot = (cx, cy)
                        break
                if spot:
                    break
            if spot or fn <= 13:
                break
            fn -= 1
            fd = max(12, fd - 1)
        if spot is None:
            spot = tuple(G[order[0]])
            rot = (y1 - y0) > (x1 - x0)
            emit(spot[0], spot[1], lines, rot)
            continue
        emit(spot[0], spot[1], lines)

    # ------------------------------------------------------ scale bar, in feet
    bx, by = FRAME[0] + 400, FRAME[3] - 350
    ft = 304.8
    for k in range(0, 20, 5):
        s.rect(bx + k * ft, by - 60, bx + (k + 5) * ft, by + 60,
               fill='#1f1d1a' if (k // 5) % 2 == 0 else '#ffffff', stroke='#1f1d1a', stroke_width=1)
    for k in (0, 5, 10, 15, 20):
        s.o.append(f'<text x="{s.X(bx + k * ft):.1f}" y="{s.Y(by + 280):.1f}" font-size="15" '
                   f'text-anchor="middle" fill="#1f1d1a" font-family="Helvetica,Arial,sans-serif">'
                   f"{k}'</text>")
    s.o.append(f'<text x="{s.X(bx + 20 * ft) + 20:.1f}" y="{s.Y(by) + 5:.1f}" font-size="15" '
               f'fill="#1f1d1a" font-family="Helvetica,Arial,sans-serif">feet</text>')

    s.o.append('</svg>')
    os.makedirs(a.out, exist_ok=True)
    out = os.path.join(a.out, 'home1-feet-plan.svg')
    open(out, 'w').write('\n'.join(s.o))
    print('wrote', out, f'{s.w} x {s.h} px, {px_mm:.5f} px/mm,', len(pieces), 'pieces,', len(rooms), 'spaces')


if __name__ == '__main__':
    main()
