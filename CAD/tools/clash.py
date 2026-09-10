"""
Structural clash audit: plan A-101 against the builder's shell.

Answers the three questions in the brief, in order:

  1. does the plan overflow the outer walls / the edge of the slab?
  2. does it build over a column or a beam?
  3. does it cover a duct, void or shaft?

Two independent sources are used for where floor exists, and they agree:

  * layer DA_BUILDING LINE is a single closed polyline round the whole 14th
    floor.  It traces the slab edge including every shaft as a notch, so its
    interior is the built floor.
  * the RERA carpet-area polygons.  Carpet area excludes voids, shafts and
    ducts by definition, so the notches in them are the same holes.

The audit runs against the building line; the carpet polygons are used to
separate "your floor" from "common property".

    python3 tools/clash.py

Writes data/clashes.csv.
"""

import csv
import os
import sys
from collections import deque

import ezdxf
import numpy as np
from matplotlib.path import Path

import frame
import home
home.select()          # --home / $OM_HOME / om-neeldhara
import immovables as IMM
import plan_model as PM

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
SRC = os.path.join(HERE, '..', 'source')

# The raster the checks run on. CELL is machinery; the window and the
# immovable shapes come from the selected home — see homes/<id>/immovables.py.
CELL = 25
X0, Y0, X1, Y1 = IMM.EXTENT
NX, NY = (X1 - X0) // CELL, (Y1 - Y0) // CELL
XS = X0 + (np.arange(NX) + 0.5) * CELL
YS = Y0 + (np.arange(NY) + 0.5) * CELL
GX, GY = np.meshgrid(XS, YS)
PTS = np.column_stack([GX.ravel(), GY.ravel()])

mirror = IMM.mirror
NAMED = IMM.NAMED
# A 'void store' is a builder zone the design IS allowed to floor: the two
# retained deck voids, with the builder's agreement, as bulk storage.
NO_FLOOR = [z for z in NAMED if z[5] != 'void store']
COMMON = IMM.COMMON


def blank():
    return np.zeros((NY, NX), bool)


def put_rect(m, x0, y0, x1, y1, val=True):
    i0, i1 = np.searchsorted(XS, [x0, x1])
    j0, j1 = np.searchsorted(YS, [y0, y1])
    m[j0:j1, i0:i1] = val


def put_poly(m, pts):
    m |= Path(np.asarray(pts, float)).contains_points(PTS).reshape(NY, NX)


def put_disc(m, cx, cy, r):
    m |= ((GX - cx) ** 2 + (GY - cy) ** 2) <= r * r


def dilate(m, mm):
    out = m.copy()
    for _ in range(int(round(mm / CELL))):
        out[1:, :] |= out[:-1, :]
        out[:-1, :] |= out[1:, :]
        out[:, 1:] |= out[:, :-1]
        out[:, :-1] |= out[:, 1:]
    return out


def close(m, mm):
    return ~dilate(~dilate(m, mm), mm)


def area(m):
    return m.sum() * CELL * CELL / 1e6


def bbox(m):
    js, is_ = np.nonzero(m)
    if not len(js):
        return None
    return (XS[is_.min()], YS[js.min()], XS[is_.max()], YS[js.max()])


# ------------------------------------------------------------- builder
def builder_layers():
    dxf = os.path.join(SRC, 'floor14.dxf')
    if not os.path.exists(dxf):
        raise SystemExit('run: gunzip -k source/floor14.dxf.gz')
    doc = ezdxf.readfile(dxf)
    want = {'DA_CARPET AREA RERA', 'DA_COLUMN', 'DA_BEAM', 'DA_BUILDING LINE'}
    out = {k: [] for k in want}

    def walk(ents, m, depth=0):
        if depth > 12:
            return
        for e in ents:
            t = e.dxftype()
            if t == 'INSERT':
                b = doc.blocks.get(e.dxf.name)
                if b is not None:
                    walk(b, (m @ e.matrix44()) if m is not None else e.matrix44(),
                         depth + 1)
            elif t in ('LWPOLYLINE', 'POLYLINE') and e.dxf.layer in want:
                pts = (list(e.get_points('xy')) if t == 'LWPOLYLINE'
                       else [(v.dxf.location[0], v.dxf.location[1]) for v in e.vertices])
                if m is not None:
                    pts = [tuple(m.transform((p[0], p[1], 0)))[:2] for p in pts]
                pts = [frame.cad(x, y) for x, y in pts]
                cx = sum(p[0] for p in pts) / len(pts)
                cy = sum(p[1] for p in pts) / len(pts)
                if -40000 < cx < 60000 and -40000 < cy < 60000:
                    out[e.dxf.layer].append(pts)

    walk(doc.modelspace(), None)
    return out


def beam_rects():
    """DA_BEAM is drawn as pairs of parallel lines, not closed polygons, so the
    two faces of each beam are merged back into one rectangle here."""
    segs, _ = frame.load_cad(x0=40000, y0=10000, x1=135000, y1=75000)
    boxes = []
    for lay, a, b, c, d in segs:
        if lay != 'DA_BEAM':
            continue
        r = [min(a, c), min(b, d), max(a, c), max(b, d)]
        if not (X0 < r[0] and r[2] < X1 and Y0 < r[1] and r[3] < Y1):
            continue
        for e in boxes:
            if (min(e[2], r[2]) - max(e[0], r[0]) > -300
                    and min(e[3], r[3]) - max(e[1], r[1]) > -300):
                e[0], e[1] = min(e[0], r[0]), min(e[1], r[1])
                e[2], e[3] = max(e[2], r[2]), max(e[3], r[3])
                break
        else:
            boxes.append(r)
    return [tuple(b) for b in boxes if b[2] - b[0] > 200 and b[3] - b[1] > 60]


def rects(polys, minsize=60):
    seen, uniq = set(), []
    for pts in polys:
        xs = [q[0] for q in pts]
        ys = [q[1] for q in pts]
        r = (min(xs), min(ys), max(xs), max(ys))
        if r[2] - r[0] < minsize or r[3] - r[1] < minsize:
            continue
        if not (X0 < r[0] and r[2] < X1 and Y0 < r[1] and r[3] < Y1):
            continue
        k = tuple(round(v / 10) for v in r)
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    return uniq


# ---------------------------------------------------------------- plan
def plan_masks():
    fl, wl = blank(), blank()
    for _, x, y, w, h in PM.FLOORS:
        put_rect(fl, x, y, x + w, y + h)
    put_disc(fl, *PM.GALLERY)
    for x1, y1, x2, y2, t, ops in PM.WALLS:
        L = float(np.hypot(x2 - x1, y2 - y1))
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        cuts = [0.0]
        for a, b in sorted(ops):
            cuts += [max(0.0, a), min(L, b)]
        cuts.append(L)
        for i in range(0, len(cuts) - 1, 2):
            a, b = cuts[i], cuts[i + 1]
            if b - a <= 1:
                continue
            ax_, ay_ = x1 + ux * a, y1 + uy * a
            bx_, by_ = x1 + ux * b, y1 + uy * b
            put_rect(wl, min(ax_, bx_) - (t / 2 if ux == 0 else 0),
                     min(ay_, by_) - (t / 2 if uy == 0 else 0),
                     max(ax_, bx_) + (t / 2 if ux == 0 else 0),
                     max(ay_, by_) + (t / 2 if uy == 0 else 0))
    ol = PM.OUTLINE + [PM.OUTLINE[0]]
    for i in range(len(ol) - 1):
        (x1, y1), (x2, y2) = ol[i], ol[i + 1]
        h = PM.T_EXT / 2
        put_rect(wl, min(x1, x2) - h, min(y1, y2) - h, max(x1, x2) + h, max(y1, y2) + h)
    cx, cy, r, segs, t = PM.ARCWALL
    for a0, a1 in segs:
        for a in np.radians(np.linspace(a0, a1, 240)):
            put_rect(wl, cx + np.cos(a) * (r - t / 2) - CELL,
                     cy + np.sin(a) * (r - t / 2) - CELL,
                     cx + np.cos(a) * (r + t / 2) + CELL,
                     cy + np.sin(a) * (r + t / 2) + CELL)
    for _, x, y, w, h in PM.PLAN_VOIDS:
        put_rect(fl, x, y, x + w, y + h, False)
    return fl, wl


def rooms_touching(r):
    out = []
    for n, x, y, w, h in PM.FLOORS:
        if not (x + w <= r[0] or x >= r[2] or y + h <= r[1] or y >= r[3]):
            out.append(n)
    g = PM.GALLERY
    if not (g[0] + g[2] <= r[0] or g[0] - g[2] >= r[2]
            or g[1] + g[2] <= r[1] or g[1] - g[2] >= r[3]):
        out.append('entry gallery')
    return sorted(set(out))


def main():
    lay = builder_layers()
    bl = max(lay['DA_BUILDING LINE'], key=len)          # the floor outline
    slab = blank()
    put_poly(slab, bl)

    carpet = blank()
    for p in lay['DA_CARPET AREA RERA']:
        put_poly(carpet, p)
    carpet = close(carpet, 200)

    cols = rects(lay['DA_COLUMN'])
    beams = beam_rects()

    plan_floor, plan_wall = plan_masks()
    plan_all = plan_floor | plan_wall
    env = blank()
    put_poly(env, PM.OUTLINE)
    env = dilate(env, PM.T_EXT / 2)

    print(f'builder slab inside the plan envelope   {area(slab & env):6.1f} m2'
          f'  ({area(slab & env) * 10.7639:.0f} sq ft)')
    print(f'plan footprint                          {area(env):6.1f} m2'
          f'  ({area(env) * 10.7639:.0f} sq ft)')

    rows = []

    # ------------------------------------------------ 0. envelope headroom
    # How far the slab runs past the plan's outer wall face, on each side.
    print('\n' + '=' * 78)
    print('0.  THE PLAN ENVELOPE AGAINST THE SLAB EDGE')
    print('=' * 78)
    probes = [('west end wall',   'x', -120,  4000, -1),
              ('east end wall',   'x', 24600, 4000, +1),
              ('deck parapet',    'y', -120, 12240, -1),
              ('entry-side wall', 'y', 10970, 12240, +1)]
    for name, axis, face, other, sgn in probes:
        d = 0
        while d < 2000:
            p = (face + sgn * (d + CELL), other) if axis == 'x' else (other, face + sgn * (d + CELL))
            i = int((p[0] - X0) // CELL)
            j = int((p[1] - Y0) // CELL)
            if not (0 <= i < NX and 0 <= j < NY and slab[j, i]):
                break
            d += CELL
        print(f'  {name:18s} plan face at {face:6.0f} - builder slab continues '
              f'{d:4.0f} mm beyond it')
        rows.append(['envelope', name, 'slab beyond plan outer face', d, '', '', '', ''])

    # ------------------------------------------------ 1. off the slab edge
    # Every piece of the plan with no builder slab under it, found from the
    # building line alone, then named by whichever known zone it falls in.
    print('\n' + '=' * 78)
    print('1.  EVERYTHING THE PLAN BUILDS WHERE THERE IS NO BUILDER SLAB')
    print('=' * 78)
    off = plan_all & ~slab
    lab = np.zeros(off.shape, int)
    cur = 0
    for j in range(NY):
        for i in range(NX):
            if off[j, i] and not lab[j, i]:
                cur += 1
                q = deque([(j, i)])
                lab[j, i] = cur
                while q:
                    a_, b_ = q.popleft()
                    for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        p, r = a_ + da, b_ + db
                        if 0 <= p < NY and 0 <= r < NX and off[p, r] and not lab[p, r]:
                            lab[p, r] = cur
                            q.append((p, r))
    total = 0.0
    for k in range(1, cur + 1):
        m = lab == k
        a = area(m)
        if a < 0.03:
            continue
        total += a
        bb = bbox(m)
        best, cov = '(unnamed)', 0
        for n, x0_, y0_, x1_, y1_, kind in NAMED:
            z = blank()
            put_rect(z, x0_, y0_, x1_, y1_)
            c = (m & z).sum()
            if c > cov:
                best, cov = f'{n} [{kind}]', c
        zc = blank()
        put_rect(zc, *COMMON[1:])
        if (m & zc).sum() > cov:
            best = COMMON[0] + ' [common property]'
        print(f'  {a:5.2f} m2 ({a * 10.7639:5.1f} sq ft)  X {bb[0]:7.0f}..{bb[2]:<7.0f} '
              f'Y {bb[1]:6.0f}..{bb[3]:<6.0f}  {best}')
        print(f'  {"":36s} plan rooms: {", ".join(rooms_touching(bb)) or "-"}')
        rows.append(['no slab under plan', best, ', '.join(rooms_touching(bb)),
                     round(a, 3), round(bb[0]), round(bb[1]),
                     round(bb[2]), round(bb[3])])
    print(f'\n  TOTAL {total:.2f} m2 ({total * 10.7639:.0f} sq ft) of plan drawn over '
          f'no slab.')

    # ------------------------------------------------ 2. columns and beams
    print('\n' + '=' * 78)
    print('2.  COLUMNS AND BEAMS')
    print('=' * 78)
    for kind, items in (('column', cols), ('beam', beams)):
        for r in sorted(items, key=lambda r: -(r[2] - r[0]) * (r[3] - r[1])):
            m = blank()
            put_rect(m, *r)
            inside = (m & env).sum() / m.sum()
            exposed = m & plan_floor & ~plan_wall
            if inside < 0.02:
                verdict, exposed = 'OUTSIDE the plan envelope', m
            elif inside < 0.98 and not exposed.sum():
                verdict = f'{100 * (1 - inside):3.0f}% outside the plan envelope'
                exposed = m & ~env
            elif not exposed.sum():
                continue
            else:
                verdict = f'{100 * exposed.sum() / m.sum():3.0f}% standing in open room'
            where = ', '.join(rooms_touching(r)) or '-'
            print(f'  {kind:6s} {r[2] - r[0]:5.0f} x {r[3] - r[1]:<5.0f}  '
                  f'X {r[0]:6.0f}..{r[2]:<6.0f} Y {r[1]:6.0f}..{r[3]:<6.0f}  '
                  f'{area(exposed):4.2f} m2  {verdict:26s} {where}')
            rows.append(['structure', kind, verdict + ' | ' + where,
                         round(area(exposed), 3), *[round(v) for v in r]])

    # ------------------------------------------------ 3. ducts and voids
    print('\n' + '=' * 78)
    print('3.  DUCTS, VOIDS AND SHAFTS COVERED BY THE PLAN')
    print('=' * 78)
    for name, a, b, c, d, kind in NO_FLOOR + [COMMON + ('common property',)][:1]:
        m = blank()
        put_rect(m, a, b, c, d)
        built = m & plan_all
        if not built.sum():
            print(f'  {name:26s} {kind:12s} left clear')
            continue
        rm = ', '.join(rooms_touching((a, b, c, d)))
        print(f'  {name:26s} {kind:12s} {c - a:5.0f} x {d - b:<5.0f} mm  '
              f'-> {area(built):5.2f} m2 ({area(built) * 10.7639:5.1f} sq ft) built over')
        print(f'  {"":26s} {"":12s} plan rooms here: {rm}')
        rows.append(['covers hole', name, kind + ' | ' + rm,
                     round(area(built), 3), a, b, c, d])

    n, a, b, c, d = COMMON
    m = blank()
    put_rect(m, a, b, c, d)
    built = m & plan_all
    inflat = m & carpet
    print(f'\n  {n:26s} {"common":12s} {c - a:5.0f} x {d - b:<5.0f} mm  '
          f'-> {area(built):5.2f} m2 ({area(built) * 10.7639:5.1f} sq ft) enclosed by the plan')
    print(f'  {"":26s} {"":12s} of which inside either flat: {area(built & inflat):.2f} m2')
    rows.append(['annexes common area', n, 'lift lobby / fire-lift landing',
                 round(area(built), 3), a, b, c, d])

    # ------------------------------------------------ 4. openings
    print('\n' + '=' * 78)
    print('4.  PLAN OPENINGS ON STRUCTURE OR OFF THE SLAB')
    print('=' * 78)
    hits = 0
    for name, x1, y1, x2, y2 in PM.OPENINGS:
        m = blank()
        put_rect(m, min(x1, x2) - 120, min(y1, y2) - 120,
                 max(x1, x2) + 120, max(y1, y2) + 120)
        for kind, items in (('column', cols), ('beam', beams)):
            for r in items:
                s = blank()
                put_rect(s, *r)
                if (m & s).sum():
                    ov = bbox(m & s)
                    w = ov[2] - ov[0] + CELL
                    print(f'  {name:24s} crosses a {kind} at X {r[0]:.0f}..{r[2]:.0f} '
                          f'Y {r[1]:.0f}..{r[3]:.0f}  ({w:.0f} mm of the opening)')
                    rows.append(['opening on structure', name,
                                 f'{kind} X {r[0]:.0f}-{r[2]:.0f}', round(w / 1000, 3),
                                 *[round(v) for v in r]])
                    hits += 1
    if not hits:
        print('  none')

    # ------------------------------------------------ 5. fixtures
    print('\n' + '=' * 78)
    print('5.  FIXED OR PLUMBED ITEMS OVER A HOLE / ON A COLUMN')
    print('=' * 78)
    holes = blank()
    for _, a, b, c, d, _ in NO_FLOOR:
        put_rect(holes, a, b, c, d)
    for name, a, b, c, d in PM.FIXTURES:
        m = blank()
        put_rect(m, a, b, c, d)
        h = m & holes
        cl = [f'column X {r[0]:.0f}-{r[2]:.0f}' for r in cols
              if (m & put_or(r)).sum()]
        if h.sum() > 2 or cl:
            bits = ([f'{area(h):.2f} m2 over an open shaft'] if h.sum() > 2 else []) + cl
            print(f'  {name:28s} {"; ".join(bits)}')
            rows.append(['fixture', name, '; '.join(bits), round(area(h), 3),
                         a, b, c, d])

    with open(os.path.join(DATA, 'clashes.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['category', 'item', 'detail', 'area_m2_or_mm',
                    'x0', 'y0', 'x1', 'y1'])
        w.writerows(rows)
    print('\nwrote data/clashes.csv')


def put_or(r):
    m = blank()
    put_rect(m, *r)
    return m


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
