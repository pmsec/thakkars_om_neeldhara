#!/usr/bin/env python3
"""
GENERIC APP EXPORT — a home's design.py to the portal's data files.

docs/design-export.py in the web app is Om Neeldhara's: it knows that plan's
mirror line, its curved pod screens and its bespoke joinery, and it must keep
producing byte-identical output. This is the plain path, for a home whose
design.py provides only the generic contract:

    ENVELOPE · NEW_WALLS · GLAZING · ROOMS · FURNITURE

    NEW_WALLS  (x1, y1, x2, y2, thickness, openings, kind[, id, note, bow, pts])
               `pts`, when given, IS the wall — an explicit centreline
               polyline, and its openings are absolute distances ALONG it.
               Otherwise the wall is the straight line between its ends, or
               the quadratic bow of it.
               openings are (type, from, to[, sill, head, side, label,
               glass]) ABSOLUTE along the wall's own axis. `side` is the
               drawer's: +1 swings the leaf to the LEFT of the wall's travel
               (the app's sign is the opposite, and is flipped here);
               `glass` ('clear' | 'tinted') stands a pane in the opening;
               a 'cased' opening above a sill whose label says 'hatch' is
               the serving hatch, and the app draws its lifting sash. A
               12th wall field, `glass`, makes the whole wall that glass.
               A wall
               of thickness 0 and kind 'threshold' divides two rooms without
               putting anything on the floor; `bow` is the sagitta in mm and
               becomes a quadratic Bezier, positive to the LEFT of travel.
    SCREENS    (x1, y1, x2, y2, bow, height, id, name, note) — optional. NOT
               walls: they stop below the ceiling and divide no rooms.
    EXTERIOR_OPENINGS
               (x1, y1, x2, y2, type, id, note) — optional, endpoints on the
               OUTER face of the envelope.
    ROOMS      (name, subtitle, anchor, note[, dimension text, sq ft])
    GLAZING    (x1, y1, x2, y2, 'window') — the builder's window lines, as
               drawn: every line of each frame. The ones on the envelope
               become the app's exterior windows, one per span, glazed.
    ENVELOPE_OPEN
               (x1, y1, x2, y2, id, parapet, rail, note) — optional. An
               envelope edge that is NOT a wall: a parapet to `parapet`, a
               glass balustrade to `rail`, and nothing above.
    FURNITURE  (kind, x1, y1, x2, y2, label, room, height, poly, ghost, face)
               `face` is which way a piece faces; missing, it is read off a
               'facing east' in the label, and a chair turns to the nearest
               table.

Rooms carry an anchor and no shape — the app derives every room polygon from
the wall centrelines, so that is genuinely all it needs. Where a home gives
the last two columns, they are the SOURCE drawing's own dimension text and
its area: the app carries them as `publishedSqFt` so the derivation can be
checked against the drawing it came from.

    python3 export_app.py --home <id> --out <webapp>/src/homes/<id>
"""

import argparse
import os
import shutil
import sys

import home


def fnum(v):
    s = f'{float(v):.3f}'.rstrip('0').rstrip('.')
    return s if s else '0'


def pt(x, y):
    return f'{{ x: {fnum(x)}, y: {fnum(y)} }}'


def flatten(x1, y1, x2, y2, bow, n=256):
    """The wall as points. Straight walls are two."""
    if not bow:
        return [(x1, y1), (x2, y2)]
    cx, cy = control(x1, y1, x2, y2, bow)
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u * u * x1 + 2 * u * t * cx + t * t * x2,
                    u * u * y1 + 2 * u * t * cy + t * t * y2))
    return out


def arc_at(pts, vert, v):
    """Distance ALONG a wall to the point at axis position `v`.

    Openings are authored against the axis — the straight line between the
    wall's ends — because that is how they are measured on a drawing. The app
    places them by distance along the RUN. On a straight wall those are the
    same number; on a bowed one they are not, and a 1730 mm bow over 5245 mm
    makes the arc a fifth longer than its chord. Getting this wrong slides
    every window along the curve.
    """
    k = 1 if vert else 0
    run = 0.0
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        seg = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        lo, hi = sorted((a[k], b[k]))
        if lo <= v <= hi and hi > lo:
            return run + seg * (v - a[k]) / (b[k] - a[k])
        run += seg
    return run


def control(x1, y1, x2, y2, bow):
    """The Bezier control point for a wall bowed by `bow`. A quadratic sits
    half way to its control point at t=0.5, so the control is offset by TWICE
    the sagitta — which is what makes `bow` mean the distance you can measure
    on the drawing."""
    dx, dy = x2 - x1, y2 - y1
    L = (dx * dx + dy * dy) ** 0.5 or 1.0
    nx, ny = -dy / L, dx / L
    return ((x1 + x2) / 2 + nx * 2 * bow, (y1 + y2) / 2 + ny * 2 * bow)


def slug(s, used):
    b = ''.join(c if c.isalnum() else '-' for c in s.upper()).strip('-')
    while '--' in b:
        b = b.replace('--', '-')
    n, out = 1, f'R-{b}'
    while out in used:
        n += 1
        out = f'R-{b}-{n}'
    used.add(out)
    return out


def _seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2))
    return ((p[0] - (ax + t * dx)) ** 2 + (p[1] - (ay + t * dy)) ** 2) ** 0.5


def envelope_windows(D):
    """The exterior windows, one per span, from the builder's window lines.

    GLAZING carries every line of every frame — four to a window, 30 or 60 mm
    apart. Lines are grouped by orientation and span; a group that lies on an
    envelope edge is one window, and the line nearest the edge stands for it.
    A group off the envelope (the balcony line, glazed on the builder's plan
    but inside our outline) is left to the walls."""
    env = list(D.ENVELOPE)
    edges = [(env[i], env[(i + 1) % len(env)]) for i in range(len(env))]
    spans = {}
    for g in getattr(D, 'GLAZING', []):
        x1, y1, x2, y2 = g[:4]
        vert = abs(x2 - x1) < abs(y2 - y1)
        key = (vert, round(min(y1, y2) if vert else min(x1, x2)),
               round(max(y1, y2) if vert else max(x1, x2)))
        spans.setdefault(key, []).append((x1, y1, x2, y2))
    # Two windows can share a span on opposite walls (the kitchen's north
    # light and the notch's south one both run 7235-7985), so a span is split
    # into frames wherever the lines are more than a wall apart.
    groups = []
    for key in sorted(spans, key=lambda k: (k[0], k[1])):
        pos = lambda ln: ln[0] if key[0] else ln[1]
        frame = []
        for ln in sorted(spans[key], key=pos):
            if frame and pos(ln) - pos(frame[-1]) > 200:
                groups.append(frame)
                frame = []
            frame.append(ln)
        groups.append(frame)
    out = []
    for lines in groups:
        best, best_d = None, 1e9
        for x1, y1, x2, y2 in lines:
            d = min(max(_seg_dist((x1, y1), a, b), _seg_dist((x2, y2), a, b))
                    for a, b in edges)
            if d < best_d:
                best, best_d = (x1, y1, x2, y2), d
        if best_d > 160:
            continue
        out.append(((best[0], best[1]), (best[2], best[3])))
    return out


_FACING = {'north': 'N', 'south': 'S', 'east': 'E', 'west': 'W'}


def face_of(f, D):
    """Which way a piece faces, for the app: given outright as the 11th
    field, else read off 'facing east' in its label, else — for a chair —
    turned toward the nearest table."""
    if len(f) > 10 and f[10]:
        return f[10]
    import re
    m = re.search(r'facing (north|south|east|west)', f[5], re.I)
    if m:
        return _FACING[m.group(1).lower()]
    if f[0] == 'chair':
        cx, cy = (f[1] + f[3]) / 2, (f[2] + f[4]) / 2
        best, best_d = None, 1e9
        for g in getattr(D, 'FURNITURE', []):
            if g[0] not in ('table', 'dining', 'console') or (len(g) > 9 and g[9]):
                continue
            tx, ty = (g[1] + g[3]) / 2, (g[2] + g[4]) / 2
            # the nearest point of the table's box, not its centre: a long
            # bar's centre is not where the chair is looking
            nx = min(max(cx, min(g[1], g[3])), max(g[1], g[3]))
            ny = min(max(cy, min(g[2], g[4])), max(g[2], g[4]))
            d = ((cx - nx) ** 2 + (cy - ny) ** 2) ** 0.5
            if d < best_d:
                best, best_d = (nx - cx, ny - cy), d
        if best and best_d < 1200:
            dx, dy = best
            return ('E' if dx > 0 else 'W') if abs(dx) >= abs(dy) else ('S' if dy > 0 else 'N')
    return None


CATEGORY = {'TOILET': 'wet', 'BATH': 'wet', 'PASSAGE': 'circulation',
            'FOYER': 'circulation', 'BALCONY': 'outdoor', 'STORE': 'storage'}
FINISH = {'wet': 'Stone', 'outdoor': 'Stone', 'circulation': 'Stone'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--home', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    home.select(a.home)
    import design as D

    meta = home.meta()
    os.makedirs(a.out, exist_ok=True)
    o = []
    A = o.append
    A('/**')
    A(f" * {meta['name']} — GENERATED by CAD/tools/export_app.py.")
    A(' * Do not edit: change the design and re-run the export.')
    A(' */')
    A('')
    A("import type { BuildingData } from '../../data/schema'")
    A('')
    A('export const MIRROR_X = 0')
    A('export const POD_PARENTS = null')
    A('export const POD_KARAN = null')
    A('')
    A('export const building: BuildingData = {')
    A('  meta: {')
    # THE TITLE BLOCK IS THE HOME'S TO SAY. It was hard-coded to BUILDER /
    # imported / "not yet designed", which was true of a flat the day it came
    # off the DWG and is a lie the day somebody starts drawing on it. A home
    # that has been designed sets `titleBlock` in home.json; one that has not
    # gets the import wording, unchanged.
    tb = meta.get('titleBlock') or {}
    _imported_note = (
        'Imported from the builder\u2019s DWG: wall centrelines paired from '
        'his drawn faces, doors off his door layer, envelope from the RERA '
        'carpet boundary. Every room checked against his own dimension text. '
        'Not yet designed.')
    A(f"    project: {meta['name']!r},")
    A(f"    drawing: {tb.get('drawing', 'BUILDER')!r},")
    A(f"    revision: {tb.get('revision', meta.get('subtitle', 'imported'))!r},")
    A(f"    date: {tb.get('date', 'imported')!r},")
    A(f"    scaleNote: {tb.get('scaleNote', _imported_note)!r},")
    A('  },')
    A('  envelope: [' + ', '.join(pt(x, y) for x, y in D.ENVELOPE) + '],')
    A('  thickness: { exterior: 150, interior: 150, partition: 125 },')
    A('  levels: { ceiling: 3050, doorHead: 2100, windowSill: 750, windowHead: 2400 },')
    A('  exteriorOpenings: [')
    for eo in getattr(D, 'EXTERIOR_OPENINGS', []):
        x1, y1, x2, y2, typ, oid = eo[:6]
        note = eo[6] if len(eo) > 6 else None
        head = 2100 if typ in ('door', 'cased', 'arch') else 2400
        sill = 0 if typ in ('door', 'cased', 'arch') else 750
        A(f"    {{ id: {oid!r}, type: {typ!r}, abs: [{pt(x1, y1)}, {pt(x2, y2)}], "
          f'head: {head}, sill: {sill}'
          + (', hinge: 0, side: 1' if typ == 'door' else '')
          + (f', notes: {note!r}' if note else '') + ' },')
    for i, (p1, p2) in enumerate(envelope_windows(D), 1):
        w = ((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) ** 0.5
        A(f"    {{ id: 'WIN-{i:02d}', type: 'window', abs: [{pt(*p1)}, {pt(*p2)}], "
          f"head: 2400, sill: 900, nonCirculating: true, glass: 'clear', "
          f"label: 'window — {w:.0f} wide, as the builder drew it' }},")
    A('  ],')
    A('  envelopeGlazing: [')
    for eo in getattr(D, 'ENVELOPE_OPEN', []):
        x1, y1, x2, y2, oid, para, rail = eo[:7]
        note = eo[7] if len(eo) > 7 else ''
        A(f"    {{ id: {oid!r}, p1: {pt(x1, y1)}, p2: {pt(x2, y2)}, pane: false, "
          f'parapet: {fnum(para)}, rail: {fnum(rail)}, label: {note!r} }},')
    A('  ],')
    A('  walls: [')
    for i, w in enumerate(D.NEW_WALLS, 1):
        x1, y1, x2, y2, t = w[:5]
        ops = w[5] if len(w) > 5 else []
        kind = w[6] if len(w) > 6 else 'partition'
        wid = w[7] if len(w) > 7 else f'W-{i:02d}'
        note = w[8] if len(w) > 8 else None
        bow = w[9] if len(w) > 9 else 0
        pts_in = w[10] if len(w) > 10 else None
        # An opening is authored in absolute mm along the wall, because that is
        # how it is read off the drawing. The app wants it as a distance from
        # the run's first point.
        vert = abs(x2 - x1) < abs(y2 - y1)
        base = y1 if vert else x1
        sgn = 1 if (y2 > y1 if vert else x2 > x1) else -1
        pts = flatten(x1, y1, x2, y2, bow)
        oo = []
        wglass = w[11] if len(w) > 11 else None
        for j, op in enumerate(ops, 1):
            typ, f0, f1 = op[:3]
            sill = op[3] if len(op) > 3 else 0
            head = op[4] if len(op) > 4 else (2400 if typ == 'window' else 2100)
            side = op[5] if len(op) > 5 and op[5] else 1
            label = op[6] if len(op) > 6 else None
            oglass = op[7] if len(op) > 7 else None
            # The serving hatch is a cased opening over the counter on the
            # drawing; to the app it is Home 1's hatch — a window it hangs the
            # lifting sash in, found by the word in its label.
            if typ == 'cased' and sill > 0 and label and 'hatch' in label.lower():
                typ = 'window'
            if pts_in:
                a0, a1 = f0, f1          # already distances along the wall
            elif bow:
                a0, a1 = arc_at(pts, vert, f0), arc_at(pts, vert, f1)
            else:
                a0, a1 = sgn * (f0 - base), sgn * (f1 - base)
            d0, d1 = sorted((a0, a1))
            extra = ''
            if typ == 'door':
                # The drawer's +1 is the LEFT of the wall's travel; the app's
                # +1 is its right. Both hinge at the opening's start.
                extra += f', hinge: 0, side: {-side}'
            if oglass:
                extra += f', glass: {oglass!r}'
            if label:
                extra += f', label: {label!r}'
            oo.append(f"{{ id: '{wid}-O{j}', type: {typ!r}, "
                      f'at: [{fnum(d0)}, {fnum(d1)}], head: {fnum(head)}, '
                      f'sill: {fnum(sill)}{extra} }}')
        if pts_in:
            shape = 'points: [' + ', '.join(pt(px, py) for px, py in pts_in) + ']'
        elif bow:
            cx, cy = control(x1, y1, x2, y2, bow)
            shape = (f'curve: {{ p0: {pt(x1, y1)}, p1: {pt(cx, cy)}, '
                     f'p2: {pt(x2, y2)} }}')
        else:
            shape = f'points: [{pt(x1, y1)}, {pt(x2, y2)}]'
        A(f"    {{ id: {wid!r}, {shape}, "
          f"thickness: {fnum(t)}, kind: {kind!r},"
          # a threshold is a line on the floor and nothing else; a glazing
          # line of no thickness gets the app's nominal pane
          + (' renderPane: false,' if t == 0 and kind == 'threshold' else '')
          + (f' glass: {wglass!r},' if wglass else '')
          + (f" notes: {note!r}," if note else '')
          + ' openings: [' + ', '.join(oo) + '] },')
    A('  ],')
    A('  cores: [],')
    A('  cages: [],')
    A('  rooms: [')
    used = set()
    for r in D.ROOMS:
        name, sub, (ax, ay), note = r[:4]
        text, sq = (r[4], r[5]) if len(r) > 5 else (None, None)
        cat = 'habitable'
        for k, v in CATEGORY.items():
            if k in name.upper():
                cat = v
        rid = slug(name if not sub else f'{name}-{sub}', used)
        fin = FINISH.get(cat, 'Oak plank')
        full = ' · '.join(x for x in (text, note) if x)
        A(f"    {{ id: {rid!r}, name: {name.title()!r}, anchor: {pt(ax, ay)}, "
          f"category: {cat!r}, zone: 'flat', carpet: {str(cat != 'outdoor').lower()}, "
          f"finish: {fin!r},"
          + (f' publishedSqFt: {sq},' if sq else '')
          + f' notes: {full!r} }},')
    A('  ],')
    A('  stacks: [],')
    A('  glassRoofs: [],')
    A('  portals: [],')
    A('  screens: [')
    for sc in getattr(D, 'SCREENS', []):
        x1, y1, x2, y2, bow, h, sid, name = sc[:8]
        note = sc[8] if len(sc) > 8 else ''
        cx, cy = control(x1, y1, x2, y2, bow)
        A(f"    {{ id: {sid!r}, name: {name!r}, curve: {{ p0: {pt(x1, y1)}, "
          f'p1: {pt(cx, cy)}, p2: {pt(x2, y2)} }}, height: {fnum(h)}, '
          f'notes: {note!r} }},')
    A('  ],')
    A('}')
    A('')
    open(os.path.join(a.out, 'building.ts'), 'w').write('\n'.join(o))

    # A FIXTURE IS NOT A PIECE OF FURNITURE. Fixtures are the built-in things
    # the app models separately — Home 1's joinery. A design can be complete
    # and have none, so say that rather than calling the home undesigned.
    open(os.path.join(a.out, 'fixtures.ts'), 'w').write(
        f"/**\n * {meta['name']} — GENERATED. This design authors no "
        "FIXTURES; what it\n * holds is furniture, which is in furniture.ts."
        "\n */\n\n"
        "import type { FixtureDef } from '../../data/schema'\n\n"
        'export const fixtures: FixtureDef[] = []\n')

    fitems = []
    # Ghosts are a drawing convention — the footprint a Murphy bed takes when
    # it is down — not objects. The app models what is standing in the room, so
    # they do not travel.
    for i, f in enumerate([g for g in getattr(D, 'FURNITURE', [])
                           if not (len(g) > 9 and g[9])], 1):
        kind, x1, y1, x2, y2, label = f[:6]
        room = f[6] if len(f) > 6 else ''
        height = f[7] if len(f) > 7 else 750
        poly = f[8] if len(f) > 8 else None
        shape = ('' if not poly else
                 ', poly: [' + ', '.join(pt(px, py) for px, py in poly) + ']')
        face = face_of(f, D)
        fitems.append(
            f"  {{ id: 'F-{i:02d}', kind: {kind!r}, x: {fnum(min(x1, x2))}, "
            f'y: {fnum(min(y1, y2))}, w: {fnum(abs(x2 - x1))}, '
            f'd: {fnum(abs(y2 - y1))}'
            + (f', face: {face!r}' if face else '')
            + f', room: {room!r}, label: {label!r}, '
            f'height: {fnum(height)}{shape} }},')

    open(os.path.join(a.out, 'furniture.ts'), 'w').write(
        f"/**\n * {meta['name']} — GENERATED by CAD/tools/export_app.py.\n */\n\n"
        "export type FurnitureKind =\n"
        "  | 'sofa' | 'bed' | 'daybed' | 'armchair' | 'table' | 'console'\n"
        "  | 'bench' | 'stool' | 'lounger' | 'rug' | 'plant' | 'tree'\n"
        "  | 'shelves' | 'dining' | 'chair' | 'drumkit' | 'guitar' | 'stair'\n"
        "  | 'wardrobe' | 'planter' | 'grass' | 'screen' | 'tv'\n\n"
        'export interface FurnitureItem {\n'
        '  id: string\n  kind: FurnitureKind\n  x: number\n  y: number\n'
        '  w: number\n  d: number\n'
        "  face?: 'N' | 'S' | 'E' | 'W'\n  room: string\n  label: string\n"
        '  height: number\n  seats?: [number, number]\n'
        '  poly?: { x: number; y: number }[]\n}\n\n'
        'export const furniture: FurnitureItem[] = [\n'
        + '\n'.join(fitems) + ('\n' if fitems else '') + ']\n')

    sheet = os.path.join(home.CAD, meta['sheet'])
    if os.path.isfile(sheet):
        shutil.copyfile(sheet, os.path.join(a.out, 'plan-sheet.svg'))
        print('copied', meta['sheet'])
    print(f"wrote building.ts ({len(D.NEW_WALLS)} walls, {len(D.ROOMS)} rooms), "
          f'fixtures.ts, furniture.ts -> {a.out}')


if __name__ == '__main__':
    main()
