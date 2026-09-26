"""
Two checks, both run against the common frame:

  1. the builder's dimension chains, rebuilt from the DWG's own DIMENSION
     entities, against the figures written on A-101;
  2. every builder column, against A-101's masonry - is the column under a
     wall the plan draws, or standing in a room the plan draws as open?

    python3 tools/analyse.py

Writes data/setout-comparison.csv and data/column-clashes.csv.
"""

import collections
import csv
import json
import os
import sys

import frame

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')

# Columns read off the builder DWG (DA_COLUMN), in frame mm.  The mirrored
# halves are drawn from two different blocks, so a few have no exact twin.
COLUMNS = [
    ('west end wall, deck side', -600, 1950, -370, 3150),
    ('west end wall, entry side', -600, 7745, -370, 8945),
    ('west wing / deck line', 4300, 1200, 4530, 2400),
    ('west wing, entry side', 4325, 8695, 4555, 9695),
    ("parents' bath zone", 5555, 9320, 5785, 10320),
    ('west retained void, inner face', 7500, 1200, 7730, 2700),
    ('lift lobby, west jamb', 10400, 9325, 10630, 11125),
    ('lift lobby, east jamb', 13850, 9325, 14080, 11125),
    ('east retained void, inner face', 16750, 1200, 16980, 2700),
    ('service-bay beam, east', 17430, 9320, 18925, 9550),
    ('east wing, entry side', 19925, 8495, 20155, 9695),
    ('east wing / deck line', 19950, 1200, 20180, 2400),
    ('east wing outer wall', 23880, 9465, 25080, 9695),
    ('east end wall, deck side', 24850, 1950, 25080, 3150),
]

# A-101's drawn outer envelope: 24480 centre-to-centre plus 240 mm walls,
# and -120 .. 10970 in depth.
A101_ENVELOPE = (-120, -120, 24600, 10970)

# Builder figure vs A-101 figure.  Builder values come from the DIMENSION
# chains printed by chains() below, or from wall faces in the flattened
# geometry; both are quoted in the report.
SETOUT = [
    ('Overall length, outer face to outer face', 25680, 24720,
     'A-101 note reads OVERALL 24 480, which is a centreline figure; '
     'the matching builder centreline figure is 25 530.'),
    ('Overall length, wall centreline to centreline', 25530, 24480, ''),
    ('Continuous deck length', 15420, 15020,
     'Builder chain 3050 + 1535 + 3050 | 150 party wall | 3050 + 1535 + 3050.'),
    ('Deck set-out, wing wall to centre (per half)', 7635, 7510,
     'A-101 note says 2875 + 1585 + 3050; builder is 3050 + 1535 + 3050.'),
    ('Deck bay, wing wall to void', 3050, 2875, ''),
    ('Retained void, width along the deck', 1535, 1585, ''),
    ('Deck bay, void to centreline', 3050, 3050, 'Correct.'),
    ('Great room across the party wall', 7840, 7690,
     '3845 + 150 party wall + 3845.  A-101 adds the two 3845s and drops the wall.'),
    ('Living room bay', 3845, 3845, 'Correct.'),
    ('Family room / music den bay', 3665, 3665, 'Correct.'),
    ('Master suite depth, two bedrooms merged', 8195, 8070,
     '4110 + 125 wall + 3960.  A-101 adds the two bedrooms and drops the wall.'),
    ('Master bedroom width', 3200, 3200, 'Correct.'),
    ('Terrace / shaft strip width', 1530, 1530, 'Correct.'),
    ('Total depth, deck face to east-bay face', 11125, 10850,
     'Builder 2620 + 150 + 5780 + 125 + 2450.  A-101 adds 2620 + 5780 + 2450.'),
    ('Deck depth', 2620, 2620, 'Correct.'),
    ('Main body depth', 5780, 5780, 'Correct.'),
    ('East bay depth', 2450, 2450, 'Correct.'),
    ('Wing depth, centreline to centreline', 9570, 9170,
     'Builder: terrace parapet CL 50 to wing outer wall CL 9620.'),
    ('Kitchen', 3350, 3350, 'Correct; A-101 then widens it to 3900 by choice.'),
    ('Lift lobby, clear width between columns', 3220, 4125,
     'A-101 uses the lobby 13\'-6" figure, which in the DWG is the lobby DEPTH.'),
    ('Sealed shaft depth at the wing end', 1050, 1350, ''),
]


def chains(dims):
    """Rebuild the builder's dimension strings from text positions."""
    sel = [(d['y'] - frame.CAD_X0, d['x'] - frame.CAD_Y0, d['measurement'])
           for d in dims
           if 58000 < d['x'] < 74000 and 29000 < d['y'] < 60000]
    along, depth = collections.defaultdict(list), collections.defaultdict(list)
    for X, Y, m in sel:
        along[round(Y / 25) * 25].append((X, m))
        depth[round(X / 25) * 25].append((Y, m))
    out = []
    for name, groups in (('along the home', along), ('depth', depth)):
        for key in sorted(groups):
            v = sorted(groups[key])
            if len(v) < 3:
                continue
            spans = [(round(p - m / 2), round(p + m / 2), round(m)) for p, m in v]
            contiguous = all(abs(spans[i + 1][0] - spans[i][1]) < 200
                             for i in range(len(spans) - 1))
            out.append((name, key, ' + '.join(str(s[2]) for s in spans),
                        spans[0][0], spans[-1][1], contiguous))
    return out


def covered(rect, walls, step=20):
    """Fraction of a rectangle that sits under A-101 masonry."""
    total = hit = 0
    x = rect[0] + step / 2
    while x < rect[2]:
        y = rect[1] + step / 2
        while y < rect[3]:
            total += 1
            if any(w[0] <= x <= w[2] and w[1] <= y <= w[3] for w in walls):
                hit += 1
            y += step
        x += step
    return hit / max(total, 1)


def inside(rect, box):
    ov = (max(0, min(rect[2], box[2]) - max(rect[0], box[0]))
          * max(0, min(rect[3], box[3]) - max(rect[1], box[1])))
    return ov / ((rect[2] - rect[0]) * (rect[3] - rect[1]))


# A-101 prints GROSS 2 688 SQ FT (249.7 m2).  That is exactly
# 15020 x 10850 for the middle plus two 4730 x 9170 wings, all centreline.
# The same sum on the builder's centrelines is below.
GROSS = {
    'a101':    dict(mid_len=15020, depth=10850, wing_len=4730, wing_depth=9170),
    'builder': dict(mid_len=15545, depth=11250, wing_len=4993, wing_depth=9570),
}


def gross(p):
    return (p['mid_len'] * p['depth'] + 2 * p['wing_len'] * p['wing_depth']) / 1e6


def main():
    walls, _ = frame.load_pdf()
    with open(os.path.join(DATA, 'builder-dimensions.json')) as fh:
        dims = json.load(fh)

    print('=== builder dimension chains (frame mm) ===')
    for kind, at, chain, a, b, ok in chains(dims):
        if not ok:
            continue
        print(f'  {kind:16s} at {at:6d}: {chain}  = {b - a}   spans {a}..{b}')

    print('\n=== set-out: builder vs A-101 ===')
    rows = []
    for name, builder, plan, note in SETOUT:
        rows.append({'item': name, 'builder_mm': builder, 'a101_mm': plan,
                     'error_mm': plan - builder, 'note': note})
        flag = '' if plan == builder else f'{plan - builder:+d}'
        print(f'  {name:52s} builder {builder:6d}   A-101 {plan:6d}   {flag:>7s}  {note}')
    with open(os.path.join(DATA, 'setout-comparison.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    print('\n=== gross envelope, on A-101\'s own centreline basis ===')
    for k, p in GROSS.items():
        a = gross(p)
        print(f'  {k:8s} {p["mid_len"]} x {p["depth"]} + 2 x {p["wing_len"]} x '
              f'{p["wing_depth"]}  =  {a:6.1f} m2  =  {a * 10.7639:6.0f} sq ft')
    d = gross(GROSS['builder']) - gross(GROSS['a101'])
    print(f'  difference {d:5.1f} m2 = {d * 10.7639:.0f} sq ft of real shell A-101 does not draw')

    print('\n=== builder columns vs A-101 ===')
    rows = []
    for name, a, b, c, d in COLUMNS:
        rect = (a, b, c, d)
        env = inside(rect, A101_ENVELOPE)
        cov = covered(rect, walls)
        if env < 0.05:
            verdict = 'outside the plan entirely'
        elif cov > 0.85:
            verdict = 'resolved - under a drawn wall'
        elif cov < 0.20:
            verdict = 'clash - stands in drawn open space'
        else:
            verdict = f'partial - {(1 - cov) * 100:.0f}% in drawn open space'
        rows.append({'column': name,
                     'x0': a, 'y0': b, 'x1': c, 'y1': d,
                     'size_mm': f'{c - a} x {d - b}',
                     'within_plan_envelope_pct': round(env * 100),
                     'under_plan_masonry_pct': round(cov * 100),
                     'verdict': verdict})
        print(f'  {name:34s} {c - a:5d} x {d - b:<5d}  '
              f'in-envelope {env * 100:3.0f}%  on-wall {cov * 100:3.0f}%   {verdict}')
    with open(os.path.join(DATA, 'column-clashes.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
