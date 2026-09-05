#!/usr/bin/env python3
"""
DXF SHELL IMPORT — step 2 of adding a home.

extract_dwg.py flattens a builder's DWG into segments by layer. This turns
those segments into the things a design needs: wall centrelines with
thicknesses, column and shaft rectangles, glazing runs, and the RERA carpet
boundary — all moved into a local frame with the flat's north-west corner
at the origin, the way every design.py is written.

The builder draws a wall as a CLOSED RECTANGLE on DA_WALL, so a wall is
recovered by tracing loops and reading the short side as its thickness. That
is a convention of this builder's office; another firm's drawing would need
its own reading, which is why this prints what it found and expects a human
to look at it.

    python3 import_shell.py --home <id> --box x0 y0 x1 y1
"""

import argparse
import collections
import json
import math
import os
import sys

import home

R = 0.5   # coordinate rounding, mm


def load(path, box):
    d = json.load(open(path))

    def ins(a, b, c, e):
        return (box[0] <= min(a, c) and max(a, c) <= box[2]
                and box[1] <= min(b, e) and max(b, e) <= box[3])
    segs = [s for s in d['segs'] if ins(*s[1:])]
    texts = [t for t in d['texts'] if box[0] <= t[1] <= box[2] and box[1] <= t[2] <= box[3]]
    return segs, texts


def loops(segs):
    """Trace closed loops out of a soup of segments."""
    def key(x, y):
        return (round(x / R) * R, round(y / R) * R)
    adj = collections.defaultdict(list)
    for _, x1, y1, x2, y2 in segs:
        a, b = key(x1, y1), key(x2, y2)
        if a == b:
            continue
        adj[a].append(b)
        adj[b].append(a)
    seen = set()
    out = []
    for start in list(adj):
        if start in seen:
            continue
        comp, stack = [], [start]
        while stack:
            n = stack.pop()
            if n in seen:
                continue
            seen.add(n)
            comp.append(n)
            stack.extend(m for m in adj[n] if m not in seen)
        if len(comp) >= 4:
            out.append(comp)
    return out


def rects(segs, tol=1.0):
    """Axis-aligned rectangles, as (x0, y0, x1, y1)."""
    found = []
    for comp in loops(segs):
        xs = sorted({p[0] for p in comp})
        ys = sorted({p[1] for p in comp})
        if len(xs) == 2 and len(ys) == 2 and len(comp) == 4:
            found.append((xs[0], ys[0], xs[1], ys[1]))
        else:
            # an L or a run of joined rectangles: fall back to the bounding box
            # only when it is thin, i.e. genuinely one wall drawn in pieces
            x0, x1 = min(p[0] for p in comp), max(p[0] for p in comp)
            y0, y1 = min(p[1] for p in comp), max(p[1] for p in comp)
            if min(x1 - x0, y1 - y0) <= 400:
                found.append((x0, y0, x1, y1))
    return found


def paired_walls(segs, tmin=75, tmax=350, min_len=200):
    """Walls as PAIRS OF PARALLEL LINES — the way they are actually drawn.

    Tracing loops fails as soon as two walls touch, because the whole network
    becomes one component. Pairing is local and survives that: two parallel
    segments a wall's thickness apart, overlapping along their length, are the
    two faces of one wall, and its centreline runs between them.
    """
    hor = [s for s in segs if abs(s[2] - s[4]) < 1 and abs(s[3] - s[1]) >= min_len]
    ver = [s for s in segs if abs(s[1] - s[3]) < 1 and abs(s[4] - s[2]) >= min_len]
    out = []

    def pair(items, along, across):
        for i, a in enumerate(items):
            a0, a1 = sorted((a[along], a[along + 2]))
            ac = a[across]
            for b in items[i + 1:]:
                t = abs(b[across] - ac)
                if not (tmin <= t <= tmax):
                    continue
                b0, b1 = sorted((b[along], b[along + 2]))
                lo, hi = max(a0, b0), min(a1, b1)
                if hi - lo < min_len:
                    continue
                mid = (ac + b[across]) / 2
                out.append((lo, hi, mid, round(t), along))
    pair(hor, 1, 2)     # horizontal: span in x, faces at two y
    pair(ver, 2, 1)     # vertical:   span in y, faces at two x
    return out


def centreline(r):
    """A wall rectangle -> (x1, y1, x2, y2, thickness) down its long axis."""
    x0, y0, x1, y1 = r
    w, h = x1 - x0, y1 - y0
    if w >= h:
        return (x0, (y0 + y1) / 2, x1, (y0 + y1) / 2, round(h))
    return ((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, round(w))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--home', required=True)
    ap.add_argument('--box', nargs=4, type=float, required=True,
                    help='x0 y0 x1 y1 in building coordinates')
    a = ap.parse_args()
    d = home.dir_for(a.home)
    segs, texts = load(os.path.join(d, 'source', 'builder-geometry.json'), a.box)

    by = collections.defaultdict(list)
    for s in segs:
        by[s[0]].append(s)

    carpet = by.get('DA_CARPET AREA RERA', [])
    cxs = [v for s in carpet for v in (s[1], s[3])]
    cys = [v for s in carpet for v in (s[2], s[4])]
    ox, oy = min(cxs), min(cys)      # local origin: the flat's NW corner
    print(f'local origin  ({ox:.0f}, {oy:.0f})  in building coordinates')

    def L(x, y):
        return (round(x - ox, 1), round(y - oy, 1))

    out = {'origin': [ox, oy], 'walls': [], 'columns': [], 'glazing': [],
           'beams': [], 'texts': [], 'carpet': []}

    for lo, hi, mid, t, along in paired_walls(by.get('DA_WALL', [])):
        if along == 1:
            out['walls'].append([*L(lo, mid), *L(hi, mid), t])
        else:
            out['walls'].append([*L(mid, lo), *L(mid, hi), t])
    for r in rects(by.get('DA_COLUMN', [])):
        if (r[2] - r[0]) * (r[3] - r[1]) < 10000:
            continue
        out['columns'].append([*L(r[0], r[1]), *L(r[2], r[3])])
    for r in rects(by.get('DA_BEAM', [])):
        out['beams'].append([*L(r[0], r[1]), *L(r[2], r[3])])
    for s in by.get('DA_WINDOW', []):
        out['glazing'].append([*L(s[1], s[2]), *L(s[3], s[4])])
    for s in carpet:
        out['carpet'].append([*L(s[1], s[2]), *L(s[3], s[4])])
    for lay, x, y, h, s in texts:
        if s.strip() and h >= 100:
            out['texts'].append([*L(x, y), round(h), s.strip()])

    p = os.path.join(d, 'source', 'shell.json')
    json.dump(out, open(p, 'w'), indent=1)
    print(f"walls   {len(out['walls'])}")
    print(f"columns {len(out['columns'])}")
    print(f"beams   {len(out['beams'])}")
    print(f"glazing {len(out['glazing'])}")
    print(f"texts   {len(out['texts'])}")
    print('->', os.path.relpath(p, HERE_CAD))
    ts = collections.Counter(round(w[4]) for w in out['walls'])
    print('wall thicknesses:', dict(ts))


HERE_CAD = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

if __name__ == '__main__':
    main()
