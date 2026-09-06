"""
THE TWO THINGS THAT HAVE ACTUALLY GONE WRONG, checked.

Neither of these is structural — verify.py and the app's own suite cover the
walls, the rooms and the envelope. Both of these are about FURNITURE, and both
have happened on this project and were found by eye, late, by accident:

  1. A PIECE STANDING INSIDE A COLUMN. Two columns have turned up inside
     something after the fact. Nothing measured furniture against the
     immovables, because clash.py reads the builder's DXF and is Home 1's.
  2. A PIECE THAT SILENTLY VANISHED. A bad edit truncated design.py and took a
     bedroom's bed and wardrobes with it. Every check still passed: the rooms
     still derived, the sheet still drew, golden.py still said OK. Sixteen
     pieces where there had been eighteen, and nothing to say so.

So: overlap against the immovables, and a manifest that has to be updated on
purpose. A count alone would not have caught it either — the round that lost
two pieces added two others — so the manifest records what each room holds.

    python3 tools/check_home.py --home ekta
    python3 tools/check_home.py --home ekta --update   # after an intended change
"""

import json
import os
import sys
from collections import Counter

import numpy as np
from matplotlib.path import Path

import home
home.select()
import design as D
import immovables as IMM

CELL = 10.0             # the grid the overlaps are measured on, in mm
TOL = 2500.0            # 50 x 50: a touch is not an overlap


def ring(f):
    """A piece's outline: its own polygon if it has one, else its box."""
    poly = f[8] if len(f) > 8 else None
    if poly:
        return [(float(a), float(b)) for a, b in poly]
    return [(f[1], f[2]), (f[3], f[2]), (f[3], f[4]), (f[1], f[4])]


def overlap(pts, x0, y0, x1, y1):
    """How much of `pts` falls inside the rectangle, in mm^2."""
    px = [p[0] for p in pts]
    py = [p[1] for p in pts]
    ax, ay = max(x0, min(px)), max(y0, min(py))
    bx, by = min(x1, max(px)), min(y1, max(py))
    if bx - ax <= 0 or by - ay <= 0:
        return 0.0
    nx = max(1, int((bx - ax) / CELL))
    ny = max(1, int((by - ay) / CELL))
    gx, gy = np.meshgrid(ax + (np.arange(nx) + 0.5) * (bx - ax) / nx,
                         ay + (np.arange(ny) + 0.5) * (by - ay) / ny)
    inside = Path(pts).contains_points(np.column_stack([gx.ravel(), gy.ravel()]))
    return inside.sum() * (bx - ax) / nx * (by - ay) / ny


def manifest():
    """What each room holds, in the order it is authored."""
    out = {}
    for f in getattr(D, 'FURNITURE', []):
        # Home 1's tuples stop at the label — they carry no room, and its
        # furniture is placed by eye against a plan that has not moved.
        room = f[6] if len(f) > 6 else '(no room)'
        ghost = ' (ghost)' if len(f) > 9 and f[9] else ''
        out.setdefault(room, []).append(f[0] + ghost)
    return out


def main():
    update = '--update' in sys.argv
    path = os.path.join(home.dir_of(), 'manifest.json')
    furn = getattr(D, 'FURNITURE', [])
    bad = []

    print(f'home: {home.current()}')
    print(f'  {len(furn)} pieces of furniture in {len(manifest())} rooms')

    # ------------------------------------------------- 1. against the structure
    for f in furn:
        if len(f) > 9 and f[9]:
            continue                # a ghost is not there; it may sit anywhere
        pts = ring(f)
        for c in IMM.NAMED:
            name, x0, y0, x1, y1 = c[0], c[1], c[2], c[3], c[4]
            a = overlap(pts, x0, y0, x1, y1)
            if a > TOL:
                where = f[6] if len(f) > 6 else f'({f[1]:.0f}, {f[2]:.0f})'
                bad.append(f'{f[0]!r} in {where} stands {a / 1e6:.3f} m2 '
                           f'inside {name}')
    for b in bad:
        print('  CLASH   ' + b)
    if not bad:
        print('  clear   nothing stands in a column, beam or shaft')

    # ---------------------------------------------------- 2. against the record
    now = manifest()
    if update:
        with open(path, 'w') as fh:
            json.dump(now, fh, indent=2, sort_keys=True)
            fh.write('\n')
        print(f'  wrote   {os.path.relpath(path)}')
        return 0
    if not os.path.exists(path):
        print(f'  NO RECORD — run --update to write {os.path.relpath(path)}')
        return 1
    was = json.load(open(path))
    lost = []
    for room in sorted(set(was) | set(now)):
        # COUNTED, not just compared. A room that already holds a sofa and
        # loses one still holds a sofa, so a set difference reports nothing —
        # which is exactly the failure this check exists to catch.
        a = Counter(was.get(room, []))
        b = Counter(now.get(room, []))
        if a != b:
            diff = []
            for k in sorted(set(a) | set(b)):
                if b[k] - a[k]:
                    diff.append(f'{b[k] - a[k]:+d} {k}')
            lost.append(f'{room}: ' + ', '.join(diff))
    for line in lost:
        print('  CHANGED ' + line)

    if bad or lost:
        print('\nCHECK FAILED — a clash is a mistake; a change is only a '
              'mistake if nobody meant it. Rerun with --update once it is '
              'reviewed.')
        return 1
    print('  clear   the furniture is what the manifest says it is')
    print('\nCHECK OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
