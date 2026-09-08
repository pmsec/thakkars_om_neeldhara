#!/usr/bin/env python3
"""
Regenerate src/data/{building,fixtures,furniture}.ts from the CAD design.

    python3 docs/design-export.py --cad /path/to/repo/CAD/tools

The CAD branch (claude/cad-apartment-merge-miwnpm) holds the authoritative
design in Python (design.py + retrofit.py); its DXF is what the architect
gets. This exporter is the bridge: it reads those modules and writes the
portal's authored data files, so the portal can never drift from the plan
except by forgetting to re-run this.

The generated files are committed. This script only needs running again when
the CAD design changes.

Idealisations, deliberate:
  * The envelope is the clean stepped outline of the home, not the builder's
    every chajja and niche. Room dimensions are exact; slab-edge noise is not.
  * Builder shell walls are taken as 150 thick throughout.

Fidelity, non-negotiable: any piece whose DRAWN outline is not its plain
rectangle (curved counters, the pantry run, the arched vanities, rounded
consoles) carries that outline as `poly` — the exact polygon the 2D sheet
draws, produced by the same symbols.py / retrofit.py code. The app extrudes
`poly` when present and its test suite fails the build if any footprint
crosses a wall, so the 3D can no longer deviate from the 2D by flattening a
curve into a box.
"""

import argparse
import math
import os
import sys

ap = argparse.ArgumentParser()
ap.add_argument('--cad', default=os.path.join(os.path.dirname(__file__), '..', '..',
                                              'thakkars_om_neeldhara', 'CAD', 'tools'))
ap.add_argument('--home', default=None,
                help='which home under CAD/homes/ (default: om-neeldhara)')
ap.add_argument('--out', default=None,
                help='where to write the .ts data (default: src/data)')
args = ap.parse_args()
sys.path.insert(0, os.path.abspath(args.cad))

import home                 # noqa: E402  the home resolver in CAD/tools
home.select(args.home)      # puts homes/<id>/ on the path before design imports

import design as D          # noqa: E402
import retrofit as R        # noqa: E402
import symbols as SY        # noqa: E402
import clash as C           # noqa: E402  (raster helpers for the coverage audit)

# Everything exported, kept for the coverage audit: (id, bbox, poly-or-None).
EXPORTED = []

# One directory per home: src/homes/<id>/ holds its generated data and its
# sheet, and the app's src/data/* resolvers pick whichever home is active.
OUT = args.out or os.path.join(os.path.dirname(__file__), '..', 'src', 'homes',
                               home.current())
os.makedirs(OUT, exist_ok=True)
M = 12240.0


def mx(x):
    return 2 * M - x


def fnum(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return s if s else '0'


def pt(x, y):
    return f'{{ x: {fnum(x)}, y: {fnum(y)} }}'


def pts(seq):
    return '[' + ', '.join(pt(x, y) for x, y in seq) + ']'


# ---------------------------------------------------------------- envelope
T_EXT = 150
ENVELOPE = [
    (-600, 0), (4530, 0), (4530, -150), (19950, -150), (19950, 0), (25080, 0),
    (25080, 9695), (18925, 9695), (18925, 11125), (5555, 11125), (5555, 9695),
    (-600, 9695),
]

ENV_GLAZING = [
    # No upright pane on any of these lines. The curved glass canopies (ROOFS below)
    # spring from floor datum ON the parapet line, belly out past it and rise clear
    # above the ceiling before landing on the wall head: they are the enclosure.
    ('EG-P-TERRACE', (-350, 0), (2750, 0), False,
     "Parents' terrace — open to the curved glass canopy, no pane on this line"),
    ('EG-DECK', (4530, -150), (19950, -150), False,
     'Deck edge — the bellied glass vault springs from this parapet line; planted '
     'strip and trellis inside it'),
    ('EG-K-TERRACE', (21730, 0), (24830, 0), False,
     "Karan's terrace — open to the curved glass canopy, no pane on this line"),
]

# ------------------------------------------------------- exterior openings
EXT_OPENINGS = [
    ('W-01', 'window', (-600, 1350), (-600, 1950), None),
    ('W-02', 'window', (-600, 8945), (-600, 9545), None),
    ('W-03', 'window', (-450, 9695), (2750, 9695),
     "Parents' dressing — the long south light"),
    ('W-04', 'window', (25080, 1350), (25080, 1950), None),
    ('W-05', 'window', (25080, 5585), (25080, 9465),
     "Karan's suite — the long east light, headboard jamb to jamb"),
    ('W-06', 'window', (7800, 11125), (9800, 11125), 'Kitchen south light'),
    # no windows on the south wall at help's room or the guest WC: that wall
    # faces the building's common passage, and the client has it closed
    ('F-MAIN', 'door', (11715, 11125), (12765, 11125), 'MAIN ENTRANCE'),
]


# ---------------------------------------------------------------- walls
def w(id_, points, th, kind, openings=(), label=None, notes=None, pane=None,
      glass=None):
    return {'id': id_, 'points': points, 'th': th, 'kind': kind,
            'openings': list(openings), 'label': label, 'notes': notes,
            'pane': pane, 'glass': glass}


def op(id_, type_, a, b, head=2100, sill=None, label=None, extra=''):
    return {'id': id_, 'type': type_, 'at': (a, b), 'head': head,
            'sill': sill, 'label': label, 'extra': extra}


WALLS = []

# --- suite / family partitions, bath walls: NEW_WALLS carried over verbatim,
# with ids and opening types assigned by what each one is.
WALLS += [
    w('W-P-BATH-W', [(2400, 6715), (2400, 9695)], 150, 'interior',
      [op('D-P-BATH', 'door', 300, 1100, label="Parents' bath door")]),
    w('W-K-BATH-E', [(22080, 6715), (22080, 9695)], 150, 'interior',
      [op('D-K-BATH', 'door', 1080, 1880, label="Karan's bath door")]),
    w('W-P-BATH-E', [(4467, 6650), (4467, 9695)], 150, 'interior'),
    w('W-K-BATH-W', [(20013, 6650), (20013, 9695)], 150, 'interior'),
    w('W-P-SUITE-E', [(4467, 1275), (4467, 6650)], 125, 'interior',
      [op('SL-P-SUITE', 'slider', 1345, 4900, head=2400,
          label='Sliding partition — suite to family room')]),
    w('W-K-SUITE-W', [(20013, 1275), (20013, 6650)], 125, 'interior',
      [op('SL-K-SUITE', 'slider', 1345, 4900, head=2400,
          label='Sliding partition — suite to den')]),
    # The parents' corner WC, where the study desk was: a west wall on the
    # sealed shaft's west wall line, and a south wall whose south face is the
    # pod slider's north jamb at 2620. Parents' side only — not mirrored.
    w('W-P-WC-W', [(2825, 1275), (2825, 2557.5)], 150, 'interior',
      notes="Corner WC's west wall, on the shaft wall's line."),
    w('W-P-WC-S', [(2750, 2557.5), (4467, 2557.5)], 125, 'interior',
      [op('SL-P-WC', 'slider', 200, 900, head=2100,
          label="Parents' corner WC — 700 sliding leaf, runs east on the outside")],
      notes="Corner WC's south wall; its south face is the pod slider's north jamb."),
    w('W-FAM-S', [(4467, 8462.5), (6900, 8462.5)], 125, 'interior',
      notes="Family room's south wall, bath bay to the hatch wall."),
    w('W-DUCT-W-E', [(6900, 8462.5), (6900, 9395)], 150, 'interior'),
    w('W-DUCT-W-S', [(5630, 9395), (6900, 9395)], 150, 'interior'),
    w('W-BAY-W', [(5630, 8462.5), (5630, 9620)], 150, 'interior',
      notes='West cheek of the kitchen bay; ends on the envelope centreline mitre.'),
    w('W-DUCT-E-N', [(18850, 6175), (20013, 6175)], 150, 'interior'),
    w('W-DUCT-E-W', [(18850, 6175), (18850, 7650)], 150, 'interior'),
    w('W-DUCT-E-S', [(18850, 7650), (20013, 7650)], 150, 'interior'),
    w('W-BAY-S', [(17505, 9545), (20013, 9545)], 150, 'interior',
      notes='Closes the suite bay off the store zone.'),
    w('W-KIT-HATCH', [(6900, 8462.5), (8725, 8462.5)], 125, 'interior',
      [op('O-HATCH', 'window', 0, 1100, head=2100, sill=900,
          label='Serving hatch — kitchen to family room')]),
    w('W-KIT-N', [(8600, 7862.5), (11450, 7862.5)], 125, 'interior',
      notes='Extended past the drum face so it dies INTO the arc.'),
    w('W-KIT-NW', [(8662.5, 7862.5), (8662.5, 8462.5)], 125, 'interior'),
    w('W-HELP-N', [(13700, 8462.5), (20013, 8462.5)], 125, 'interior',
      [op('D-WC-GREAT', 'door', 1320, 2120,
          label='Guest WC — from the great room, west of the pod glazing')]),
    w('W-STORE-W', [(17505, 8462.5), (17505, D.WC_DIE + D.T_WC / 2)], 150, 'interior',
      notes="The secondary duct's west cheek. The partition that used to run south "
            "from the apse at 16800 and split the store off help's room is gone: "
            "the two are one room."),
]

# --- the entry gallery's two straight legs (230 thick, on the columns)
WALLS += [
    w('W-GAL-W', [(10515, 9325), (10515, 11125)], 230, 'interior',
      label='Entry gallery — west leg'),
    w('W-GAL-E', [(13965, 9325), (13965, 11125)], 230, 'interior',
      label='Entry gallery — east leg'),
]

# --- sealed shafts flanking the deck (walled, void inside).  Their side
# walls close the terrace-to-deck band completely: the west cheek covers the
# strip against the terrace wall, the east cheek stands on the deck edge.
WALLS += [
    w('W-SHAFT-W-W', [(2825, 0), (2825, 1275)], 150, 'interior'),
    w('W-SHAFT-W-E', [(4530, 0), (4530, 1275)], 150, 'interior'),
    w('W-SHAFT-W-S', [(2750, 1275), (4605, 1275)], 150, 'interior'),
    w('W-SHAFT-E-W', [(19950, 0), (19950, 1275)], 150, 'interior'),
    w('W-SHAFT-E-E', [(21655, 0), (21655, 1275)], 150, 'interior'),
    w('W-SHAFT-E-S', [(19875, 1275), (21730, 1275)], 150, 'interior'),
]

# --- the two retained deck voids (between deck and pods)
for vid, (a, b, c, d) in (('W', D.VOID_KEEP[0]), ('E', D.VOID_KEEP[1])):
    WALLS += [
        w(f'W-VOID-{vid}-N', [(a, b), (c, b)], 150, 'interior'),
        w(f'W-VOID-{vid}-W', [(a, b), (a, d)], 150, 'interior'),
        w(f'W-VOID-{vid}-E', [(c, b), (c, d)], 150, 'interior'),
        w(f'W-VOID-{vid}-S', [(a, d), (c, d)], 150, 'interior'),
    ]

# The ceiling. The sheet carries no clear-height figure (the DWG is a bare
# shell), so the height is the owner's: 11 ft 6 in. Every wall, every
# full-height opening, the flat pod-bay roofs and the vault landings run to it.
CEIL = 3505

# --- suite <-> terrace sliders (glazing, fully openable). These are glazing
# LINES, not walls: the glass runs floor to ceiling and the ceiling simply
# stops at them, so the sliders' head is the ceiling and no spandrel is drawn.
WALLS += [
    w('G-P-TERRACE', [(-350, 1275), (2750, 1275)], 0, 'glazing',
      [op('SL-P-TERR', 'slider', 0, 3100, head=CEIL,
          label='Terrace sliders — full width, floor to ceiling')], pane=True),
    w('G-K-TERRACE', [(21730, 1275), (24830, 1275)], 0, 'glazing',
      [op('SL-K-TERR', 'slider', 0, 3100, head=CEIL,
          label='Terrace sliders — full width, floor to ceiling')], pane=True),
    w('W-P-TERR-STUB', [(-600, 1275), (-350, 1275)], 150, 'interior'),
    w('W-K-TERR-STUB', [(24830, 1275), (25080, 1275)], 150, 'interior'),
]

# --- deck <-> rooms glazing lines: floor to ceiling, the ceiling stops at them
WALLS += [
    w('G-FAMILY-DECK', [(4650, 2545), (7500, 2545)], 0, 'glazing',
      [op('SL-FAM-DECK', 'slider', 0, 2850, head=CEIL,
          label='Family room sliders to the deck')], pane=True),
    w('G-GREAT-DECK', [(9115, 2545), (15365, 2545)], 0, 'glazing',
      [op('SL-GREAT-DECK', 'slider', 0, 6250, head=CEIL,
          label='Great room sliders to the deck — 6250 clear')], pane=True),
    w('G-DEN-DECK', [(16980, 2545), (19830, 2545)], 0, 'glazing',
      [op('SL-DEN-DECK', 'slider', 0, 2850, head=CEIL,
          label='Den sliders to the deck')], pane=True),
    w('W-DECK-W-STUB', [(4467, 2545), (4650, 2545)], 150, 'interior'),
    w('W-DECK-E-STUB', [(19830, 2545), (20013, 2545)], 150, 'interior'),
]

# --- dressing partitions: bronze translucent glass floor to ceiling, the leaf
# pocketing into the cupboard backs; both suites
WALLS += [
    w('W-P-DRESS', [(-600, 5935), (2732, 5935), (2940, 6300)], 120, 'partition',
      [op('SL-P-DRESS', 'slider', 150, 3332, head=2100,
          label='Tinted glass end to end — two 1591 bypass leaves on a double track, no pocket')],
      label="Parents' dressing partition", glass='tinted'),
    # Karan's side has NO partition on this line: his suite runs from the terrace
    # wall to the dressing screen at 7675 (a screen, not a wall - the bed leans on
    # it), and the sheet draws nothing at 5935. The mirrored copy that used to be
    # here was an invention.
]

# --- master bath arched sweeps, from the CAD geometry (polyline centreline)
def sweep_centreline(quads, ext=140.0):
    """The mid-line of a drawn wall strip: average the two rails of each quad,
    then push both ends out along their tangents so the line crosses whatever
    wall it dies into rather than stopping a face-width short of it."""
    ptsl = []
    for q in quads:
        n = len(q) // 2
        inner, outer = q[:n], list(reversed(q[n:]))
        for a, b in zip(inner, outer):
            ptsl.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
    (x0, y0), (x1, y1) = ptsl[0], ptsl[1]
    L = math.hypot(x1 - x0, y1 - y0) or 1.0
    ptsl.insert(0, (x0 - (x1 - x0) / L * ext, y0 - (y1 - y0) / L * ext))
    (x0, y0), (x1, y1) = ptsl[-1], ptsl[-2]
    ptsl.append((x0 - (x1 - x0) / L * ext, y0 - (y1 - y0) / L * ext))
    return ptsl


mbq = R.mb_wall()
mb_line = sweep_centreline(mbq, ext=0.0)
# snap the two feet on to the bath walls' centrelines: the west foot ties to
# the top of W-P-BATH-W at (2400, 6715), the east to W-P-BATH-E at (4467, 6715)
mb_line = ([(2400, 6715)] + mb_line + [(4467, 6715)]
           if mb_line[0][0] < mb_line[-1][0]
           else [(4467, 6715)] + mb_line + [(2400, 6715)])
mb_len = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(mb_line, mb_line[1:]))
# The sweeps are FULL curves: the sheet takes nothing out of them. Each bath is
# entered through the door in its straight west (parents') / east (Karan's)
# wall, and the curved vanity is struck off the inside of the sweep.
WALLS += [
    w('W-P-BATH-ARCH', mb_line, 230, 'interior', [],
      label="Parents' bath — arched sweep"),
    w('W-K-BATH-ARCH', [(mx(x), y) for x, y in mb_line], 230, 'interior', [],
      label="Karan's bath — arched sweep"),
]

wcq = R.wc_wall()
wc_line = sweep_centreline(wcq)
wc_len = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(wc_line, wc_line[1:]))


def _along(line, pt):
    """Distance along a polyline to its point nearest `pt`."""
    best, s, acc = None, 0.0, 0.0
    for a, b in zip(line, line[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if seg:
            t = max(0.0, min(1.0, ((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / seg ** 2))
            q = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
            d = math.hypot(q[0] - pt[0], q[1] - pt[1])
            if best is None or d < best:
                best, s = d, acc + t * seg
        acc += seg
    return s


# The apse carries ONE door, help's room's, exactly where the sheet takes it out
# of the wall (D.WC_DOOR, a parameter range on the ellipse). The great room's
# way into the WC is the 800 opening in the straight wall at y 8462.5.
_wc_door = (_along(wc_line, R.wc_pt(D.WC_DOOR[0])), _along(wc_line, R.wc_pt(D.WC_DOOR[1])))
WALLS += [
    w('W-WC-SWEEP', wc_line, D.T_WC, 'interior',
      [op('D-WC-HELP', 'door', min(_wc_door), max(_wc_door), head=2100,
          label="Guest WC — from help's room, on the apse")],
      label='Guest WC — quarter-ellipse sweep'),
]

# --- pod screens: the real curves, flattened, with the real portals
def pod_wall(P, portal, wid, label, y_end):
    ts = [t / 200 for t in range(201)]
    line = [R.bez(P, t) for t in ts if R.bez(P, t)[1] <= y_end]
    ts = ts[:len(line)]
    line.append((line[-1][0], y_end))
    # arc-length distances of the portal's t range
    def s_at(tv):
        s = 0.0
        for t0, t1 in zip(ts, ts[1:]):
            a = R.bez(P, t0)
            b = R.bez(P, t1)
            seg = math.hypot(b[0] - a[0], b[1] - a[1])
            if t1 <= tv:
                s += seg
            else:
                s += seg * max(0.0, (tv - t0) / (t1 - t0))
                break
        return s
    a, b = s_at(portal[0]), s_at(portal[1])
    return w(wid, line, 150, 'curved-glass',
             [op(wid.replace('W-', 'PORTAL-'), 'arch', a, b, head=2400,
                 label='Arched portal — a pair of curved glass leaves slide on the screen')],
             label=label, glass='tinted')


WALLS += [
    pod_wall(D.POD_W, D.POD_PORTAL_W, 'W-CURVE-PARENTS',
             'Family pod — curved glass screen', 7862.5),
    pod_wall(D.POD_E, D.POD_PORTAL_E, 'W-CURVE-KARAN',
             'Den pod — curved glass screen, wood dado below', 8462.5),
]

# --- the entry gallery drum: solid arc segments + threshold gaps with doors
gx, gy, gr, gt, gaps = D.GALLERY


def in_gap(a):
    for g0, g1 in gaps:
        g0m, g1m, am = g0 % 360, g1 % 360, a % 360
        if (g0m <= g1m and g0m <= am <= g1m) or (g0m > g1m and (am >= g0m or am <= g1m)):
            return True
    return False


segs = []
cur = []
start = gaps[0][0]
for i in range(0, 2401):
    a = start + i * 0.15
    if in_gap(a):
        if cur:
            segs.append(cur)
            cur = []
        continue
    cur.append(a)
    if a - start >= 360:
        break
if cur:
    segs.append(cur)
for i, seg in enumerate(segs):
    line = [(gx + math.cos(math.radians(a)) * gr,
             gy + math.sin(math.radians(a)) * gr) for a in seg]
    WALLS.append(w(f'W-GAL-ARC-{i + 1}', line, 230, 'interior',
                   label='Entry gallery — the drum'))

# threshold chords across the drum's gaps, carrying the doors.  Built from
# the ACTUAL sampled segment endpoints — chords struck from the nominal gap
# angles landed up to 5 mm off the segment ends and every door leaked.
def arc_pt(a):
    return (gx + math.cos(math.radians(a)) * gr,
            gy + math.sin(math.radians(a)) * gr)


seg_pts = [[(gx + math.cos(math.radians(a)) * gr,
             gy + math.sin(math.radians(a)) * gr) for a in seg] for seg in segs]
CHORDS = [
    ('GAL-W', (10515, 9325), seg_pts[0][0], 'door',
     'Service door — west, to the kitchen'),
    ('GAL-N', seg_pts[0][-1], seg_pts[1][0], 'arch',
     'Arched portal to the great room — curved doors slide on the arc'),
    ('GAL-E', seg_pts[1][-1], (13965, 9325), 'door',
     "Service door — east, to help's side"),
]
for gid, a0, a1, typ, lab in CHORDS:
    L = math.hypot(a1[0] - a0[0], a1[1] - a0[1])
    head = CEIL if typ == 'arch' else 2100   # the arch runs to the ceiling; its doors are full height
    WALLS.append(w(f'T-{gid}', [a0, a1], 0, 'threshold',
                   [op(f'D-{gid}', typ, 0, L, head=head, label=lab)]))

# ------------------------------------------------------------------ rooms
ROOMS = [
    ('R-P-TERRACE', "Parents' terrace", (1200, 600), 'outdoor', 'outdoor', False,
     'Real grass', 'Real grass, a tall tree on the centre line, a jhoola. High glass roof over.'),
    ('R-K-TERRACE', "Karan's terrace", (23280, 600), 'outdoor', 'outdoor', False,
     'Real grass', 'Mirror of the parents’ terrace: grass, tree, jhoola under high glass.'),
    ('R-DECK', 'All-weather deck', (12240, 1800), 'outdoor', 'shared', False,
     'Oak plank', 'Glazed, cooled, retractable roof. The fountain on the home’s centre; '
     'spa in the east grass bed, gym in the west one.'),
    ('R-SHAFT-W', 'Sealed shaft (west)', (3700, 600), 'void', 'core', False,
     'Sealed', 'Builder shaft, sealed. 1480 × 1200.'),
    ('R-SHAFT-E', 'Sealed shaft (east)', (20800, 600), 'void', 'core', False,
     'Sealed', 'Builder shaft, sealed. 1480 × 1200.'),
    ('R-VOID-W', 'Retained deck void (west)', (8300, 1900), 'void', 'core', False,
     'Open void', 'Retained builder void, 1615 × 1420. The west deck recliner backs on to it.'),
    ('R-VOID-E', 'Retained deck void (east)', (mx(8300), 1900), 'void', 'core', False,
     'Open void', 'Retained builder void, 1615 × 1420. The east deck recliner backs on to it.'),

    ('R-P-SUITE', 'Master suite — parents', (1500, 3500), 'habitable', 'parents', True,
     'Oak plank', 'Bed zone north of the tinted-glass partition; opens full-width to the '
     'terrace. A full-height cupboard curls round the bath’s arch.'),
    ('R-P-WC', "Parents' corner WC", (3250, 2000), 'wet', 'parents', True,
     'Stone', 'Where the study desk was: pan on the column face, basin by the door, a 700 '
     'sliding leaf. Drains to the sealed shaft directly north — a new drop.'),
    ('R-P-DRESSING', "Parents' dressing", (1200, 8000), 'circulation', 'parents', True,
     'Oak plank', 'The grandmother’s Murphy bed — a queen, folded away 51 weeks a year — '
     'behind a partition of brown tinted glass end to end, two bypass leaves.'),
    ('R-P-BATH', "Parents' bath", (3400, 8000), 'wet', 'parents', True,
     'Stone', 'Entered through the arched sweep; curved vanity, WC, shower.'),
    ('R-K-SUITE', 'Master suite — Karan', (mx(1500), 3500), 'habitable', 'karan', True,
     'Oak plank', 'The king bed, headboard window-jamb to window-jamb; the dressing '
     'zone south of the screen, with two hanging wardrobes and the dresser.'),
    ('R-K-BATH', "Karan's bath", (mx(3400), 8000), 'wet', 'karan', True,
     'Stone', 'Mirror of the parents’ bath.'),

    ('R-P-FAMILY', 'Family room', (6550, 5000), 'habitable', 'parents', True,
     'Oak plank', 'The west pod: six-seat dining behind the curved glass screen, serving '
     'hatch straight from the kitchen.'),
    ('R-K-DEN', 'Music + work den', (18000, 5000), 'habitable', 'karan', True,
     'Oak plank', 'The east pod: Karan’s work console on the screen, e-drums in the '
     'corner, two recliners facing the deck.'),
    ('R-GREAT', 'Great room', (12240, 5000), 'habitable', 'shared', True,
     'Oak plank', 'The heart. Party wall gone; one floor with the deck through 6250 of '
     'sliding glass; the apse and its two sconces at the south.'),

    ('R-DUCT-W', 'Main service duct (west)', (6265, 8900), 'void', 'core', False,
     'Riser', 'The kitchen’s wet wall backs on to it.'),
    ('R-DEAD-W', 'Dead slab behind the bath', (5050, 9100), 'void', 'core', False,
     'Inaccessible', 'Between the bath bay and the kitchen bay; no door, no use.'),
    ('R-DUCT-E', 'Main service duct (east)', (19400, 6900), 'void', 'core', False,
     'Riser', 'The den’s corner units back on to it.'),
    ('R-DUCT-SE', 'Secondary duct / riser bay', (18200, 9000), 'void', 'core', False,
     'Riser', 'Between help’s room’s store end and Karan’s bath.'),
    ('R-KITCHEN', 'Kitchen', (7800, 10000), 'wet', 'service', True,
     'Stone', 'One working room, kitchen and utility together; hatch to the family room.'),
    ('R-ENTRY', 'Entry gallery', (12240, 10000), 'circulation', 'shared', True,
     'Stone', 'The drum: a U of 230 walls on the two columns, curved doors sliding on '
     'the arc, console and two chairs, sconces at the arc centres.'),
    ('R-HELP', "Help's room", (14700, 9200), 'habitable', 'service', True,
     'Vinyl', 'Live-in, with the store as its east end: one room. Bunk under the '
     'duct, cupboard in the duct’s corner, its own door off the gallery.'),
    ('R-GUEST-BATH', 'Guest / service WC', (16500, 9000), 'wet', 'shared', True,
     'Stone', 'Behind the quarter-ellipse sweep: curved console, WC, 900 shower.'),
]

# Stack positions are DERIVED: each sits at the centroid of the plumbed
# fixtures it serves, so the wet-stack integrity check is self-consistent and
# still catches any fixture that later wanders off its group.
STACK_POS = {}
STACKS = [
    ('STK-P-BATH', "Parents' bath stack", 'R-P-BATH',
     'At the centroid of this bath’s plumbed fixtures; confirm against the sanctioned plumbing drawings.'),
    ('STK-K-BATH', "Karan's bath stack", 'R-K-BATH',
     'Mirror of STK-P-BATH about x = 12240.'),
    ('STK-GUEST', 'Guest WC stack', 'R-GUEST-BATH',
     'On the builder’s common-toilet zone beside the secondary duct.'),
    ('STK-P-WC', "Parents' corner WC stack", 'R-P-WC',
     'Into the sealed shaft directly north of the WC — a NEW drop, to be confirmed against the sanctioned plumbing drawings.'),
    ('STK-KITCHEN', 'Kitchen stack', 'R-KITCHEN',
     'At the sink and dishwasher run.'),
]

# The bellied glass. ONE vault over the whole north front, terrace to terrace:
# it used to be three (the deck and a shallower one over each terrace, with a
# gap over each shaft between them) and the owner wants one belly, bedroom to
# bedroom. The section is ABSOLUTE (model y, height) and CUBIC - four points,
# two of them controls - drawn to the owner's sketch: it springs from floor
# datum on the deck's parapet line and rises near-vertically, leaning out,
# bellies 2170 OUT past the building line, rounds over at 6060 (19 ft 11 in)
# and comes down on the wall head along the pod line. Over the terraces the
# same curve sails over the terrace wall head at 4560 and comes down on the
# suite roof at that same line; its foot there runs 150 proud of the terrace
# parapet, on the steel sill that carries it along the deck. Both ends are
# closed with a glazed gable cut to the curve, standing on the building's end
# walls.
VAULTS = {
    # id: (springs at y, control 1, control 2, lands at y)
    'ROOF-FRONT': ((-150, 0), (-2000, 2600), (-5100, 9900), (2620, CEIL)),
}


def _bez(*pts, t):
    """A point on a quadratic (3 points) or cubic (4 points) Bezier."""
    u = 1 - t
    if len(pts) == 3:
        p0, p1, p2 = pts
        return tuple(u * u * p0[i] + 2 * t * u * p1[i] + t * t * p2[i] for i in range(2))
    p0, p1, p1b, p2 = pts
    return tuple(u ** 3 * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p1b[i] + t ** 3 * p2[i]
                 for i in range(2))


def vault_extent(rid, x0, x1):
    """Plan extent of a vault: x range, and y from the belly's outermost point
    to the landing line, so the extent is the true plan footprint."""
    pts = VAULTS[rid]
    ys = [_bez(*pts, t=i / 400)[0] for i in range(401)]
    return (x0, math.floor(min(ys) / 10) * 10, x1, pts[-1][0])


ROOFS = [
    ('ROOF-FRONT', 'One retractable bellied glass vault over the whole north front', 'barrel',
     vault_extent('ROOF-FRONT', -600, 25080), None, True, 'Laminated acoustic glass',
     "Roof AND wall, terrace to terrace: springs from the deck's parapet line, bellies "
     '1.2 m out over the street, peaks at 6.1 m - 2.6 m above the ceiling - and lands on '
     'the pod line. It sails over both terrace walls and both shafts, so the deck, the '
     "parents' terrace and Karan's terrace are one glass room: cooled under glass, open "
     'when the roof retracts. Real grass and a real tree on each terrace under it.'),
    ('ROOF-FAMILY', 'Glass roof over the family-room bay', 'flat',
     (4650, 2620, 8315, 4900), CEIL, False, 'Laminated glass', None),
    ('ROOF-DEN', 'Glass roof over the den bay', 'flat',
     (16165, 2620, 19830, 4900), CEIL, False, 'Laminated glass', None),
]


# ----------------------------------------------------------- building.ts
def emit_building():
    o = []
    A = o.append
    A('/**')
    A(' * THE SINGLE SOURCE OF TRUTH for the building fabric — GENERATED.')
    A(' *')
    A(' * Generated by docs/design-export.py from the CAD branch’s design.py +')
    A(' * retrofit.py (the same source that builds the architect’s DXF). Edit the')
    A(' * CAD design and re-run the exporter; do not hand-edit this file.')
    A(' *')
    A(' * Coordinates: the CAD frame, millimetres. x −600…25080 west→east,')
    A(' * y −150 (deck slab edge) → 11125 (entry front). Mirror axis x = 12240.')
    A(' */')
    A('')
    A("import type { BuildingData } from '../../data/schema'")
    A('')
    A('/** Curved pod screens, exported for the dimension layer’s labels. */')
    p = D.POD_W
    A(f'export const POD_PARENTS = {{ p0: {pt(*p[0])}, p1: {pt(*p[1])}, p2: {pt(*p[-1])} }}')
    p = D.POD_E
    A(f'export const POD_KARAN = {{ p0: {pt(*p[0])}, p1: {pt(*p[1])}, p2: {pt(*p[-1])} }}')
    A('')
    A('/** Mirror axis for the two wings; the suite proves the fabric honours it. */')
    A('export const MIRROR_X = 12240')
    A('')
    A('export const building: BuildingData = {')
    A('  meta: {')
    A("    project: 'Om Neeldhara — Floor 14',")
    A("    drawing: 'A-101',")
    A("    revision: 'Round 1 (CAD branch)',")
    A("    date: 'August 2026',")
    A("    scaleNote: 'Generated from the CAD design; the DXF on the CAD branch is the "
      "construction reference. Envelope idealised to the clean home outline.',")
    A('  },')
    A('')
    A(f'  envelope: {pts(ENVELOPE)},')
    A('')
    A(f'  thickness: {{ exterior: {T_EXT}, interior: 150, partition: 110 }},')
    A(f'  levels: {{ ceiling: {CEIL}, doorHead: 2100, windowSill: 900, windowHead: 2400 }},')
    A('')
    A('  exteriorOpenings: [')
    for oid, typ, p1, p2, lab in EXT_OPENINGS:
        extra = ", hinge: 0, side: 1" if typ == 'door' else ''
        labs = f', label: {lab!r}' if lab else ''
        nonc = ", nonCirculating: true, sill: 900" if typ == 'window' else ''
        head = 2400 if typ == 'window' else 2100
        A(f'    {{ id: {oid!r}, type: {typ!r}, abs: [{pt(*p1)}, {pt(*p2)}], '
          f'head: {head}{nonc}{extra}{labs} }},')
    A('  ],')
    A('')
    A('  envelopeGlazing: [')
    for gid, p1, p2, pane, lab in ENV_GLAZING:
        A(f'    {{ id: {gid!r}, p1: {pt(*p1)}, p2: {pt(*p2)}, pane: {str(pane).lower()}, '
          f'label: {lab!r} }},')
    A('  ],')
    A('')
    A('  walls: [')
    for wd in WALLS:
        A('    {')
        A(f'      id: {wd["id"]!r},')
        line = wd['points']
        if len(line) > 8:
            A('      points: [')
            for i in range(0, len(line), 6):
                A('        ' + ', '.join(pt(x, y) for x, y in line[i:i + 6]) + ',')
            A('      ],')
        else:
            A(f'      points: {pts(line)},')
        A(f'      thickness: {fnum(wd["th"])},')
        A(f'      kind: {wd["kind"]!r},')
        if wd.get('pane') is not None:
            A(f'      renderPane: {str(wd["pane"]).lower()},')
        if wd.get('glass'):
            A(f'      glass: {wd["glass"]!r},')
        if wd['openings']:
            A('      openings: [')
            for o2 in wd['openings']:
                bits = [f'id: {o2["id"]!r}', f'type: {o2["type"]!r}',
                        f'at: [{fnum(o2["at"][0])}, {fnum(o2["at"][1])}]',
                        f'head: {o2["head"]}']
                if o2['sill'] is not None:
                    bits.append(f'sill: {o2["sill"]}')
                    bits.append('nonCirculating: true')
                if o2['type'] == 'door':
                    bits.append('hinge: 0')
                    bits.append('side: 1')
                if o2['label']:
                    bits.append(f'label: {o2["label"]!r}')
                A('        { ' + ', '.join(bits) + ' },')
            A('      ],')
        if wd['label']:
            A(f'      label: {wd["label"]!r},')
        if wd['notes']:
            A(f'      notes: {wd["notes"]!r},')
        A('    },')
    A('  ],')
    A('')
    A('  cores: [],')
    A('  cages: [],')
    A('')
    A('  rooms: [')
    PUB = {'R-P-TERRACE': 40, 'R-K-TERRACE': 40, 'R-DECK': 385, 'R-P-SUITE': 350, 'R-K-SUITE': 350, 'R-P-BATH': 69, 'R-K-BATH': 69, 'R-P-FAMILY': 230, 'R-K-DEN': 230, 'R-GREAT': 407, 'R-KITCHEN': 126, 'R-ENTRY': 101, 'R-HELP': 77, 'R-GUEST-BATH': 29}
    # One floor runs out through the sliding glass: the deck is finished as the
    # great room is, and whatever the great room's floor is dressed as, the
    # deck follows.
    FOLLOWS = {'R-DECK': 'R-GREAT'}
    for rid, name, anchor, cat, zone, carpet, finish, notes in ROOMS:
        pub = f', publishedSqFt: {PUB[rid]}' if rid in PUB else ''
        fol = f', finishFollows: {FOLLOWS[rid]!r}' if rid in FOLLOWS else ''
        A(f'    {{ id: {rid!r}, name: {name!r}, anchor: {pt(*anchor)}, '
          f'category: {cat!r}, zone: {zone!r}, carpet: {str(carpet).lower()}, '
          f'finish: {finish!r}{fol}{pub}, notes: {notes!r} }},')
    A('  ],')
    A('')
    A('  stacks: [')
    for sid, name, room, prov in STACKS:
        at = STACK_POS.get(sid, (0, 0))
        A(f'    {{ id: {sid!r}, name: {name!r}, at: {pt(*at)}, room: {room!r}, '
          f'provenance: {prov!r} }},')
    A('  ],')
    A('')
    A('  glassRoofs: [')
    for rid, name, kind, ext, ht, retr, glz, notes in ROOFS:
        n = f', notes: {notes!r}' if notes else ''
        if kind == 'barrel':
            vp = VAULTS[rid]
            if len(vp) == 4:
                p0, p1, p1b, p2 = vp
                sec = (f'section: {{ p0: {pt(*p0)}, p1: {pt(*p1)}, p1b: {pt(*p1b)}, p2: {pt(*p2)} }}, '
                       f"gableEnds: ['x0', 'x1'], ")
            else:
                p0, p1, p2 = vp
                sec = (f'section: {{ p0: {pt(*p0)}, p1: {pt(*p1)}, p2: {pt(*p2)} }}, '
                       f"gableEnds: ['x0', 'x1'], ")
        else:
            sec = f'height: {ht}, '
        A(f'    {{ id: {rid!r}, name: {name!r}, kind: {kind!r}, '
          f'extent: [{", ".join(fnum(v) for v in ext)}], {sec}'
          f'retractable: {str(retr).lower()}, glazing: {glz!r}{n} }},')
    A('  ],')
    A('')
    A('  portals: [],')
    A('  screens: [],')
    A('}')
    A('')
    return '\n'.join(o)


# ----------------------------------------------------------- fixtures.ts
def bbox_of(prims, styles=('solid',)):
    xs, ys = [], []
    for p in prims:
        if p[-1] not in styles:
            continue
        if p[0] == 'poly':
            xs += [q[0] for q in p[1]]
            ys += [q[1] for q in p[1]]
        elif p[0] == 'rect':
            xs += [p[1], p[3]]
            ys += [p[2], p[4]]
        elif p[0] == 'circle':
            # circles are real objects too — the drum kit is nothing else
            xs += [p[1] - p[3], p[1] + p[3]]
            ys += [p[2] - p[3], p[2] + p[3]]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def outline_of(prims, styles=('solid',)):
    """The drawn footprint of a piece: its first solid outline primitive.

    Every symbol and retrofit generator in the CAD library puts the outline
    first and the detail (basins, mirrors, shelf lines) after it, so this IS
    the shape the 2D sheet draws. A circle outline (round tables, the swivel
    chair) becomes a polygon — round in 2D stays round in 3D. None means the
    outline is a plain rect and the bbox tells the whole truth."""
    for p in prims:
        if p[0] == 'poly' and p[-1] in styles:
            return p[1]
        if p[0] == 'circle' and p[-1] in styles:
            _, ccx, ccy, r, _ = p
            return [(ccx + r * math.cos(math.radians(t)),
                     ccy + r * math.sin(math.radians(t)))
                    for t in range(0, 360, 10)]
        if p[0] == 'rect' and p[-1] in styles:
            return None
    return None


OPP = {'n': 'S', 's': 'N', 'e': 'W', 'w': 'E'}


def face_from_drawn(prims, a, b, c, d):
    """The way a piece FACES, read off the drawing itself.

    Backs, headboards and pillows are drawn 'soft' at the piece's back or
    head, so face = opposite the edge the soft prims hug. Reading the NAME
    (sofa-e, bed-rw) proved unreliable — 'sofa-e' means back-on-east, which
    is facing WEST, and 'bed-rw' told the old suffix map nothing at all.
    The drawing cannot be misread. Soft prims outside the bbox are fronts
    (a recliner's deployed footrest), so only inside ones vote."""
    votes = {}
    for p in prims:
        if p[-1] != 'soft':
            continue
        if p[0] == 'rect':
            x0, y0 = min(p[1], p[3]), min(p[2], p[4])
            x1, y1 = max(p[1], p[3]), max(p[2], p[4])
        elif p[0] == 'poly':
            xs = [q[0] for q in p[1]]
            ys = [q[1] for q in p[1]]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        else:
            continue
        if x0 < a - 1 or x1 > c + 1 or y0 < b - 1 or y1 > d + 1:
            continue
        ex, ey = (x0 + x1) / 2, (y0 + y1) / 2
        edges = {'w': ex - a, 'e': c - ex, 'n': ey - b, 's': d - ey}
        side = min(edges, key=edges.get)
        votes[side] = votes.get(side, 0) + (x1 - x0) * (y1 - y0)
    if not votes:
        return None
    return OPP[max(votes, key=votes.get)]


def thin(poly, tol=20):
    """Drop sampled points closer than tol mm, KEEPING both ends — curve ends
    land exactly on wall centrelines and must stay there."""
    out = [poly[0]]
    for q in poly[1:-1]:
        if math.dist(out[-1], q) >= tol:
            out.append(q)
    out.append(poly[-1])
    return out


def poly_field(poly):
    return f', poly: {pts(thin([(q[0], q[1]) for q in poly]))}' if poly else ''


def emit_fixtures():
    fx = []

    def add(fid, kind, cx, cy, wd, dp, room, stack=None, label=None, rot=None,
            poly=None, bowl=None):
        fx.append((fid, kind, cx, cy, wd, dp, room, stack, label, rot, poly,
                   bowl))
        EXPORTED.append((fid, (cx - wd / 2, cy - dp / 2, cx + wd / 2,
                               cy + dp / 2), poly))

    # from the furniture list: the plumbed and fitted pieces
    for kind, a, b, c, d, lab in D.FURNITURE:
        base = kind.split('-')[0]
        cx, cy = (a + c) / 2, (b + d) / 2
        if base == 'wc':
            room, stack = (('R-GUEST-BATH', 'STK-GUEST') if 15000 < cx < 18500
                           else ('R-P-WC', 'STK-P-WC') if cx < M and cy < 2620
                           else ('R-P-BATH', 'STK-P-BATH') if cx < M
                           else ('R-K-BATH', 'STK-K-BATH'))
            add(f'FX-WC-{len(fx)}', 'wc', cx, cy, c - a, d - b, room, stack, 'WC')
        elif base == 'basin':
            # the corner WC's wall-hung basin (the vanities come from their consoles)
            add(f'FX-BASIN-{len(fx)}', 'basin', cx, cy, c - a, d - b, 'R-P-WC',
                'STK-P-WC', 'Basin, 450 × 350')
        elif base == 'shower':
            room, stack = (('R-GUEST-BATH', 'STK-GUEST') if 15000 < cx < 18500
                           else ('R-P-BATH', 'STK-P-BATH') if cx < M
                           else ('R-K-BATH', 'STK-K-BATH'))
            add(f'FX-SH-{len(fx)}', 'shower', cx, cy, c - a, d - b, room, stack, 'Shower')
        elif base == 'sink':
            add(f'FX-SINK-{len(fx)}', 'sink', cx, cy, c - a, d - b, 'R-KITCHEN',
                'STK-KITCHEN', 'Sink')
        elif base == 'hob':
            add(f'FX-HOB-{len(fx)}', 'hob', cx, cy, c - a, d - b, 'R-KITCHEN',
                None, 'Hob, 600 × 510')
        elif base == 'under':
            if 7000 < cx < 10000 and cy > 10000:
                add(f'FX-DW-{len(fx)}', 'washer', cx, cy, c - a, d - b, 'R-KITCHEN',
                    'STK-KITCHEN', 'Integrated dishwasher')
            elif lab and ('microwave' in lab.lower() or 'fryer' in lab.lower()):
                # the small appliances on the worktop, one each
                add(f'FX-APP-{len(fx)}', 'appliance', cx, cy, c - a, d - b, 'R-KITCHEN',
                    None, 'Microwave' if 'microwave' in lab.lower() else 'Air fryer')
        elif base == 'appliance':
            if 'washer' in (lab or '').lower() or 'dryer' in (lab or '').lower():
                add(f'FX-LDRY-{len(fx)}', 'laundry', cx, cy, c - a, d - b,
                    'R-KITCHEN', 'STK-KITCHEN', 'Washer and dryer, stacked')
            else:
                add(f'FX-FR-{len(fx)}', 'fridge', cx, cy, c - a, d - b,
                    'R-KITCHEN', None, 'Tall fridge')

    # the kitchen's counter runs, each with its TRUE drawn polygon — the runs
    # turn corners and end on curves, and each ships the shape the sheet
    # draws, so no size cap is needed to stop a bbox bridging the room
    n = 0
    for fn in (R.kitchen_counter(), R.hob_counter()):
        for p in fn:
            if p[-1] != 'solid' or p[0] != 'poly':
                continue
            xs = [q[0] for q in p[1]]
            ys = [q[1] for q in p[1]]
            a, b, c, d = min(xs), min(ys), max(xs), max(ys)
            if (c - a) < 200 or (d - b) < 200:
                continue
            n += 1
            add(f'FX-CTR-{n}', 'counter', (a + c) / 2, (b + d) / 2, c - a, d - b,
                'R-KITCHEN', None, 'Counter run', poly=p[1])

    # the three curved vanities: bbox for placement, TRUE poly for shape, and
    # the drawn bowl circle so the 3D sets a basin exactly where the sheet does
    def bowl_of(prims):
        for p in prims:
            if p[0] == 'circle':
                return (p[1], p[2], p[3])
        return None

    van = outline_of(R.mb_console())
    if van:
        a, b, c, d = bbox_of(R.mb_console())
        bw = bowl_of(R.mb_console())
        add('FX-P-VAN', 'basin', (a + c) / 2, (b + d) / 2, c - a, d - b,
            'R-P-BATH', 'STK-P-BATH', 'Curved vanity, 400 bowl', poly=van,
            bowl=bw)
        add('FX-K-VAN', 'basin', mx((a + c) / 2), (b + d) / 2, c - a, d - b,
            'R-K-BATH', 'STK-K-BATH', 'Curved vanity, 400 bowl',
            poly=[(mx(q[0]), q[1]) for q in van],
            bowl=(mx(bw[0]), bw[1], bw[2]) if bw else None)
    van = outline_of(R.wc_console())
    if van:
        a, b, c, d = bbox_of(R.wc_console())
        add('FX-G-VAN', 'basin', (a + c) / 2, (b + d) / 2, c - a, d - b,
            'R-GUEST-BATH', 'STK-GUEST', 'Curved console, 344 bowl', poly=van,
            bowl=bowl_of(R.wc_console()))

    # the bath wall cabinet at the west end of each sweep — same face as the
    # console, so the 3D shows one continuous run of joinery
    cab = outline_of(R.mb_cabinet())
    if cab:
        a, b, c, d = bbox_of(R.mb_cabinet(), styles=('solid',))
        add('FX-P-CAB', 'counter', (a + c) / 2, (b + d) / 2, c - a, d - b,
            'R-P-BATH', None, 'Bath wall cabinet', poly=cab)
        add('FX-K-CAB', 'counter', mx((a + c) / 2), (b + d) / 2, c - a, d - b,
            'R-K-BATH', None, 'Bath wall cabinet',
            poly=[(mx(q[0]), q[1]) for q in cab])
    # and the shelf unit carrying that face on down the duct wall
    shl = outline_of(R.mb_shelves())
    if shl:
        a, b, c, d = bbox_of(R.mb_shelves(), styles=('solid',))
        add('FX-P-SHELF', 'counter', (a + c) / 2, (b + d) / 2, c - a, d - b,
            'R-P-BATH', None, 'Bath shelves, duct wall', poly=shl)
        add('FX-K-SHELF', 'counter', mx((a + c) / 2), (b + d) / 2, c - a, d - b,
            'R-K-BATH', None, 'Bath shelves, duct wall',
            poly=[(mx(q[0]), q[1]) for q in shl])

    # place each stack at its fixture group's centroid
    groups = {}
    for fid, kind, cx, cy, wd, dp, room, stack, label, rot, poly, bowl in fx:
        if stack:
            groups.setdefault(stack, []).append((cx, cy))
    for sid, pts_ in groups.items():
        STACK_POS[sid] = (sum(p[0] for p in pts_) / len(pts_),
                          sum(p[1] for p in pts_) / len(pts_))

    o = []
    A = o.append
    A('/**')
    A(' * Sanitaryware and fitted appliances — GENERATED by docs/design-export.py.')
    A(' * Fabric, not furniture: these tie each wet room to its stack.')
    A(' */')
    A('')
    A("import type { FixtureDef } from '../../data/schema'")
    A('')
    A('export const fixtures: FixtureDef[] = [')
    for fid, kind, cx, cy, wd, dp, room, stack, label, rot, poly, bowl in fx:
        s = f', stack: {stack!r}' if stack else ''
        lb = f', label: {label!r}' if label else ''
        bw = (f', bowl: {{ x: {fnum(bowl[0])}, y: {fnum(bowl[1])}, '
              f'r: {fnum(bowl[2])} }}' if bowl else '')
        A(f'  {{ id: {fid!r}, kind: {kind!r}, at: {pt(cx, cy)}, '
          f'size: [{fnum(wd)}, {fnum(dp)}], room: {room!r}{s}{lb}'
          f'{poly_field(poly)}{bw} }},')
    A(']')
    A('')
    return '\n'.join(o)


# ----------------------------------------------------------- furniture.ts
KIND_MAP = {
    'sofa': 'sofa', 'recliner': 'lounger', 'swivel': 'armchair',
    'sidetable': 'table', 'counter': 'console', 'console': 'console',
    'dining': 'dining', 'bed': 'bed', 'murphy': 'bed', 'bunk': 'bed',
    'hanging': 'wardrobe', 'joinery': 'wardrobe', 'shelves': 'shelves',
    'plant': 'plant', 'basket': 'stool', 'bin': 'stool',
    'gym': 'shelves', 'spa': 'table', 'fountain': 'plant',
    'drum': 'drumkit',
    # SEMANTICS MATTER: a drawn screen is thin and see-through above its
    # dado, a monitor is a slim dark panel on a desk, a mirror is a pane.
    # Mapping these to opaque solids once put a phantom WALL in Karan's
    # suite — the dressing screen as a full-height white slab.
    'screen': 'tv', 'tint': 'screen', 'mirror': 'screen',
}
HEIGHTS = {'sofa': 780, 'lounger': 800, 'armchair': 780, 'table': 480,
           'console': 800, 'dining': 750, 'bed': 550, 'wardrobe': 2300,
           'shelves': 1400, 'plant': 1200, 'stool': 400, 'rug': 12,
           'bench': 450, 'drumkit': 900, 'tree': 2500,
           'screen': 2100, 'tv': 1300}


def room_for(cx, cy):
    if cy < 1275 and (cx < 2900 or cx > mx(2900)):
        return 'R-P-TERRACE' if cx < M else 'R-K-TERRACE'
    if cy < 2545 and 4530 <= cx <= 19950:
        return 'R-DECK'
    if 2825 < cx < 4467 and 1275 < cy < 2557.5:
        return 'R-P-WC'
    if cy < 5935 and cx < 4467:
        return 'R-P-SUITE'
    if cy >= 5935 and cx < 2400:
        return 'R-P-DRESSING'
    if cx < 4480 and cy >= 5935:
        return 'R-P-DRESSING'
    if cy < 5935 and cx > mx(4467):
        return 'R-K-SUITE'
    if cy >= 5935 and cx > mx(2400):
        return 'R-K-SUITE'
    if cx < 9115 and cy < 8400:
        return 'R-P-FAMILY'
    if cx > 15365 and cy < 8400 and cx < 20013:
        return 'R-K-DEN'
    if 9115 <= cx <= 15365 and cy < 8400:
        return 'R-GREAT'
    # the entry gallery before the kitchen: the U's west leg is at 10515 and
    # the kitchen's bump reaches 11210, so the strip between is the gallery's
    if 10515 <= cx <= 13965 and cy >= 8400:
        return 'R-ENTRY'
    if cy >= 8400 and 5555 < cx < 11210:
        return 'R-KITCHEN'
    # help's room runs from the gallery's east leg round the apse and on under
    # the secondary duct to the east wall — the old store is its east end
    if 13965 < cx < 16800 and cy >= 8400:
        return 'R-HELP'
    if cx >= 16800 and cy >= 9550:
        return 'R-HELP'
    if cx >= 15000 and cy >= 8400:
        return 'R-GUEST-BATH'
    return 'R-GREAT'


def emit_furniture():
    items = []
    seen = {}

    def add(kind, x, y, wd, dp, room, label, height, face=None, seats=None,
            poly=None, lift=0):
        base = f'FN-{kind.upper()}'
        seen[base] = seen.get(base, 0) + 1
        items.append((f'{base}-{seen[base]}', kind, x, y, wd, dp, room, label,
                      height, face, seats, poly, lift))
        EXPORTED.append((f'{base}-{seen[base]}', (x, y, x + wd, y + dp), poly))

    FACE = {'n': 'N', 's': 'S', 'e': 'E', 'w': 'W'}
    for kind, a, b, c, d, lab in D.FURNITURE:
        base = kind.split('-')[0]
        suff = kind.split('-')[1] if '-' in kind else None
        # Wall cabinets hung over a desk are drawn as 'under' with "over" in
        # the label: they exist in 3D as shelves lifted off the floor.
        if base == 'under' and 'over' in (lab or '').lower():
            add('shelves', a, b, c - a, d - b, room_for((a + c) / 2, (b + d) / 2),
                'Wall cabinets, 350 deep', 700,
                poly=[(a, b), (c, b), (c, d), (a, d)], lift=1400)
            continue
        if base in ('wc', 'shower', 'sink', 'hob', 'under', 'appliance',
                    'magic'):
            continue                      # plumbed / fitted: fixtures.ts
        # The 'shelves' symbol on the hatch line draws the HATCH, not a piece of
        # furniture: the opening is in the wall and the sash lives in 3D there.
        if base == 'shelves' and 'hatch' in (lab or '').lower():
            continue
        # The deck's real grass and the planted strip inside the parapet are
        # DRAWN — so they exist in 3D too, as ground-level items.
        if base == 'grass':
            add('grass', a, b, c - a, d - b, room_for((a + c) / 2, (b + d) / 2),
                (lab or 'real grass').split('·')[0].strip(), 25)
            continue
        if base == 'planter':
            add('planter', a, b, c - a, d - b,
                room_for((a + c) / 2, (b + d) / 2),
                'Planted strip inside the parapet', 340)
            continue
        if base == 'murphy':
            # A SOFA WALL BED is two things while it is closed, which is nearly
            # always: the 400 cabinet on the wall, and the two-seat sofa in
            # front of it that the bed folds down over. Each is its own piece,
            # so the 3D shows a cabinet and a sofa, not a low 400 mm "bed".
            CAB = 400
            east = suff == 'e'
            cab = (a, b, a + CAB, d) if east else (c - CAB, b, c, d)
            sb = (a + CAB, b, c, d) if east else (a, b, c - CAB, d)
            room = room_for((a + c) / 2, (b + d) / 2)
            add('wardrobe', cab[0], cab[1], cab[2] - cab[0], cab[3] - cab[1],
                room, 'Wall bed cabinet — queen 1500 x 2000 folds down over the sofa',
                2200, poly=[(cab[0], cab[1]), (cab[2], cab[1]),
                            (cab[2], cab[3]), (cab[0], cab[3])])
            sprims = SY.symbol('sofa-w' if east else 'sofa-e', *sb)
            add('sofa', sb[0], sb[1], sb[2] - sb[0], sb[3] - sb[1], room,
                '2-seat sofa in front of the wall bed', 780,
                face='E' if east else 'W', poly=outline_of(sprims))
            continue
        mapped = KIND_MAP.get(base)
        if not mapped:
            continue
        cx, cy = (a + c) / 2, (b + d) / 2
        room = room_for(cx, cy)
        label = (lab.split('·')[0].strip() or base) if lab else base
        h = HEIGHTS.get(mapped, 600)
        if base == 'bunk':
            label, h = 'Bunk bed', 2000
        if base == 'gym':
            label, h = 'All-in-one strength trainer', 2150
        if base == 'spa':
            label, h = '4-seat spa', 880
        if base == 'fountain':
            label, h = 'Marble fountain', 420
        # a headboard is a board you lean on, not a 2300 wardrobe slab
        if 'headboard' in label.lower():
            h = 1350
        face = FACE.get(suff or '', None)
        # A dining group is DECOMPOSED: the table with its true drawn outline
        # (superellipse or round), and every chair the symbol draws as its own
        # item, exactly where and how many the sheet shows. The 3D renders
        # these; it no longer invents a chair arrangement from a seat count.
        if mapped == 'dining':
            prims = SY.symbol(kind, a, b, c, d)
            top = prims[0]
            if top[0] == 'circle':
                _, ccx, ccy, r, _ = top
                outline = [(ccx + r * math.cos(math.radians(t)),
                            ccy + r * math.sin(math.radians(t)))
                           for t in range(0, 360, 10)]
            elif top[0] == 'poly':
                outline = top[1]
            else:
                outline = None
            add('dining', a, b, c - a, d - b, room, label, h, poly=outline)
            tcx, tcy = (a + c) / 2, (b + d) / 2
            for p in prims[1:]:
                if p[0] != 'rect' or p[-1] != 'solid':
                    continue
                _, x0, y0, x1, y1, _ = p
                dxc, dyc = tcx - (x0 + x1) / 2, tcy - (y0 + y1) / 2
                cface = (('E' if dxc > 0 else 'W') if abs(dxc) >= abs(dyc)
                         else ('S' if dyc > 0 else 'N'))
                add('chair', x0, y0, x1 - x0, y1 - y0,
                    room_for((x0 + x1) / 2, (y0 + y1) / 2),
                    'Dining chair', 880, face=cface)
            continue
        prims = SY.symbol(kind, a, b, c, d)
        # Orientation READ OFF THE DRAWING for anything with a drawn back or
        # pillows; the name-suffix map stays only as a fallback (murphy folds).
        if mapped in ('sofa', 'bed', 'lounger', 'armchair'):
            face = face_from_drawn(prims, a, b, c, d) or face
        # The drawn outline, from the SAME symbol code the 2D sheet uses: a
        # rounded or curved piece carries its true polygon, so the 3D cannot
        # square it back off. Slab kinds without one get their plain rect,
        # so square joinery (the study desk's L) extrudes as solid runs too.
        outline = None
        if mapped in ('console', 'table', 'wardrobe', 'shelves', 'stool',
                      'bench', 'sofa', 'bed', 'lounger', 'armchair'):
            outline = outline_of(prims)
        if outline is None and mapped in ('console', 'table', 'wardrobe',
                                          'shelves', 'stool', 'bench'):
            outline = [(a, b), (c, b), (c, d), (a, d)]
        add(mapped, a, b, c - a, d - b, room, label, h, face,
            poly=outline)
        # Recliners are drawn with the footrest DEPLOYED — a soft poly beyond
        # the seat. It is on the sheet, so it exists in 3D, as its own piece.
        if base == 'recliner':
            for p in SY.symbol(kind, a, b, c, d):
                if p[0] != 'poly' or p[-1] != 'soft':
                    continue
                xs = [q[0] for q in p[1]]
                ys = [q[1] for q in p[1]]
                if (min(xs) >= a - 1 and max(xs) <= c + 1
                        and min(ys) >= b - 1 and max(ys) <= d + 1):
                    continue              # the back band, inside the seat
                add('stool', min(xs), min(ys), max(xs) - min(xs),
                    max(ys) - min(ys), room, 'Recliner footrest, deployed',
                    380)

    # the retrofit set: bbox for placement, face read off the drawn backs,
    # and the drawn outline attached — a ROTATED chair's silhouette carries
    # its rotation, which a bounding box never can
    def add_prims(prims, kind, room, label, h, styles=('solid',)):
        bb = bbox_of(prims, styles)
        if bb:
            a, b, c, d = bb
            face = (face_from_drawn(prims, a, b, c, d)
                    if kind in ('sofa', 'armchair', 'lounger') else None)
            outline = (outline_of(prims, styles)
                       if kind in ('sofa', 'armchair', 'lounger') else None)
            add(kind, a, b, c - a, d - b, room, label, h, face=face,
                poly=outline)

    # The sofa and its planter are drawn by one generator, sofa first and the
    # planter box (the second solid outline) after it. One bounding box over
    # both would give the 3D a sofa 2800 long with the tree standing in its
    # end, so the box is split off here and ships as the planter it is.
    sofa_prims = R.great_room_sofa()
    solid_polys = [i for i, p_ in enumerate(sofa_prims)
                   if p_[0] == 'poly' and p_[-1] == 'solid']
    if len(solid_polys) >= 2:
        cut = solid_polys[1]
        add_prims(sofa_prims[:cut], 'sofa', 'R-GREAT',
                  '2-seat recliner sofa, the planter box off its end', 780)
        bx = [q[0] for q in sofa_prims[cut][1]]
        by = [q[1] for q in sofa_prims[cut][1]]
        add('planter', min(bx), min(by), max(bx) - min(bx), max(by) - min(by),
            'R-GREAT', "The planter box on the sofa's end, the tree in it",
            450, poly=sofa_prims[cut][1])
    else:
        add_prims(sofa_prims, 'sofa', 'R-GREAT',
                  '2-seat recliner sofa with the planter on its end', 780)
    add_prims(R.rocking_chair(13080, 3500, face=(10123 - 13080, 3932 - 3500)),
              'armchair', 'R-GREAT', 'Rocking chair', 780)
    add_prims(R.armchair(13800, 5050, (11640 - 13800, 4400 - 5050)),
              'armchair', 'R-GREAT', 'Armchair', 780)
    # The drum kit ships every drawn circle - pads, cymbals, throne - as parts,
    # each with a role read off its style and size, so the 3D builds the real
    # kit on the sheet's own layout. The footprint takes the cymbals in too.
    kit = R.drum_kit()
    ROLE = {('soft', 250): 'throne', ('solid', 175): 'snare', ('solid', 280): 'kick',
            ('solid', 150): 'tom', ('solid', 215): 'floortom',
            ('light', 175): 'hihat', ('light', 250): 'ride', ('light', 210): 'crash'}
    kb = bbox_of(kit, ('solid', 'soft', 'light'))
    if kb:
        a, b, c, d = kb
        parts = [(px, py, r, ROLE.get((st, int(round(r))), 'pad'))
                 for (_, px, py, r, st) in kit]
        seen['FN-DRUMKIT'] = seen.get('FN-DRUMKIT', 0) + 1
        fid = f"FN-DRUMKIT-{seen['FN-DRUMKIT']}"
        items.append((fid, 'drumkit', a, b, c - a, d - b, 'R-K-DEN',
                      'Electronic drum kit, Roland TD-27', 1300, None, None, None, 0,
                      parts))
        EXPORTED.append((fid, (a, b, c, d), None))
    # corner units piece by piece, each with its TRUE drawn polygon — the
    # mandir wedge and the pantry run follow the pod glazing, and a bounding
    # box here is exactly the shape that pokes through the curved screen
    for p in R.corner_units():
        if p[-1] not in ('solid', 'wood') or p[0] != 'poly':
            continue
        xs = [q[0] for q in p[1]]
        ys = [q[1] for q in p[1]]
        a, b, c, d = min(xs), min(ys), max(xs), max(ys)
        if (c - a) < 250 or (d - b) < 250 or (c - a) > 3000 or (d - b) > 3000:
            continue
        add('console', a, b, c - a, d - b, room_for((a + c) / 2, (b + d) / 2),
            'Corner unit', 750, poly=p[1])

    # trees: one per terrace centre, plus the great-room planter tree
    add('tree', 1200 - 350, 600 - 350, 700, 700, 'R-P-TERRACE',
        'The terrace tree — real, in real grass', 2500)
    add('tree', mx(1200) - 350, 600 - 350, 700, 700, 'R-K-TERRACE',
        'The terrace tree — real, in real grass', 2500)
    # the laundry basket in the utility bay, between the fridge and the stack
    add('basket', 6467, 10555, 420, 420, 'R-KITCHEN', 'Laundry basket, woven', 560)
    # the great-room tree stands in its planter box: lifted to the soil line
    add('tree', 10123 - 450, 5087 - 450, 900, 900, 'R-GREAT',
        'The tree in the planter box off the sofa’s end', 2400, lift=400)
    # the terraces as DRAWN by terrace_pieces(): the grass field, and the
    # jhoola where its frame actually stands (posts at x -200 and 610)
    add('planter', -350, 0, 3100, 200, 'R-P-TERRACE', 'Planted strip inside the parapet', 340)
    add('planter', 21730, 0, 3100, 200, 'R-K-TERRACE', 'Planted strip inside the parapet', 340)
    add('grass', -350, 200, 3100, 1000, 'R-P-TERRACE', 'real grass', 25)
    add('grass', 21730, 200, 3100, 1000, 'R-K-TERRACE', 'real grass', 25)
    add('bench', -200, 250, 900, 700, 'R-P-TERRACE', 'Jhoola', 1900)
    add('bench', 23780, 250, 900, 700, 'R-K-TERRACE', 'Jhoola', 1900)

    # ---- the drawn pieces the bounding-box era never exported at all.
    # Each ships its TRUE outline; none of these is a guess.
    def add_outline(prims, kind, room, label, h, mirror=False,
                    styles=('solid',)):
        p = outline_of(prims, styles)
        if not p:
            return
        if mirror:
            p = [(mx(q[0]), q[1]) for q in p]
        xs = [q[0] for q in p]
        ys = [q[1] for q in p]
        add(kind, min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys),
            room, label, h, poly=p)

    # the great-room rug — the full-width field the sitting group stands on
    add_outline(R.great_room_rug(), 'rug', 'R-GREAT',
                'The great-room rug, leaf-patterned', 12, styles=('soft',))
    # the arch consoles either side: the parents' (cut by the sliding screen)
    # and Karan's, drawn mirrored
    # the parents' is a FULL-HEIGHT CUPBOARD on the same curl: their hanging
    # space, now that the partition cupboards are gone
    add_outline(R.arch_console_par(), 'wardrobe', 'R-P-SUITE',
                'Arch cupboard — full height, on the bath sweep', 2300)
    add_outline(R.arch_console(), 'console', 'R-K-SUITE',
                'Arch console', 800, mirror=True)
    # Karan's dressing screen — wood below, tinted glass above
    add_outline(R.suite_screen(), 'screen', 'R-K-SUITE',
                'Dressing screen — wood dado, tinted glass over', 2100,
                styles=('wood',))
    # the great room's planter, answering the kitchen bump across the room
    add_outline(R.great_room_planter(), 'planter', 'R-GREAT',
                'Great-room planter', 340, styles=('green',))

    o = []
    A = o.append
    A('/**')
    A(' * Loose furniture — GENERATED by docs/design-export.py from the CAD')
    A(' * design’s furniture schedule. Its own layer, excluded from integrity.')
    A(' */')
    A('')
    A("export type FurnitureKind =")
    A("  | 'sofa' | 'bed' | 'daybed' | 'armchair' | 'table' | 'console'")
    A("  | 'bench' | 'stool' | 'lounger' | 'rug' | 'plant' | 'tree'")
    A("  | 'shelves' | 'dining' | 'chair' | 'drumkit' | 'guitar' | 'stair'")
    A("  | 'wardrobe' | 'planter' | 'grass' | 'screen' | 'tv' | 'basket'")
    A('')
    A('export interface FurnitureItem {')
    A('  id: string')
    A('  kind: FurnitureKind')
    A('  x: number')
    A('  y: number')
    A('  w: number')
    A('  d: number')
    A("  face?: 'N' | 'S' | 'E' | 'W'")
    A('  room: string')
    A('  label: string')
    A('  height: number')
    A('  /** Height above the floor the piece starts at, mm: wall cabinets hang. */')
    A('  lift?: number')
    A('  seats?: [number, number]')
    A('  /** The drawn 2D outline when it is not the plain rect — the 3D extrudes THIS. */')
    A('  poly?: { x: number; y: number }[]')
    A('  /** A composite piece drawn as circles - a drum kit - with each circle named. */')
    A('  parts?: { x: number; y: number; r: number; role: string }[]')
    A('}')
    A('')
    A('export const furniture: FurnitureItem[] = [')
    for it in items:
        fid, kind, x, y, wd, dp, room, label, h, face, seats, poly, lift = it[:13]
        parts = it[13] if len(it) > 13 else None
        f = f", face: '{face}'" if face else ''
        s = f', seats: [{seats[0]}, {seats[1]}]' if seats else ''
        lf = f', lift: {lift}' if lift else ''
        pf = ''
        if parts:
            pf = ', parts: [' + ', '.join(
                f'{{ x: {fnum(px)}, y: {fnum(py)}, r: {fnum(r)}, role: {role!r} }}'
                for px, py, r, role in parts) + ']'
        A(f'  {{ id: {fid!r}, kind: {kind!r}, x: {fnum(x)}, y: {fnum(y)}, '
          f'w: {fnum(wd)}, d: {fnum(dp)}, room: {room!r}, label: {label!r}, '
          f'height: {h}{f}{s}{lf}{pf}{poly_field(poly)} }},')
    A(']')
    A('')
    return '\n'.join(o)


# ------------------------------------------------------ the coverage audit
def audit_coverage():
    """THE COMPLETENESS GATE. Every primitive the sheet's floor + furniture
    layers draw must be covered by something this exporter shipped — if the
    2D shows it, the 3D must have it. Runs on the same generator calls
    draw_design.py makes, so a piece added to the drawing and not mapped
    here kills the export with its name instead of silently vanishing.

    Excluded, deliberately: door leaves (the model carries the openings),
    glass sliders (architecture, not furniture), dashed prims (the sheet's
    own 'not there in plan' convention), decor styles (shelf lines, sconce
    glows), tree-crown circles (crowns overhang; the trunk is the footprint),
    and prims under 0.02 m2 (knobs, diyas, drain circles)."""
    mask = C.blank()
    for _fid, (x0, y0, x1, y1), poly in EXPORTED:
        if poly:
            C.put_poly(mask, [(q[0], q[1]) for q in poly])
        else:
            C.put_rect(mask, x0, y0, x1, y1)

    drawn = []

    def take(name, prims, mirror=False):
        for p in prims:
            drawn.append((name, R._mirror_prim(p) if mirror else p))

    take('great_room_rug', R.great_room_rug())
    take('terrace_pieces', R.terrace_pieces())
    take('kitchen_counter', R.kitchen_counter())
    take('hob_counter', R.hob_counter())
    take('magic_corner', R.magic_corner())
    take('drum_kit', R.drum_kit())
    for kind, a, b, c, d, lab in D.FURNITURE:
        take(f'symbol:{kind}', SY.symbol(kind, a, b, c, d))
    take('wc_console', R.wc_console())
    for fn in (R.mb_console, R.mb_cabinet, R.mb_shelves):
        take(fn.__name__, fn())
        take(fn.__name__, fn(), mirror=True)
    take('arch_console_par', R.arch_console_par())
    take('arch_console', R.arch_console(), mirror=True)
    take('suite_screen', R.suite_screen())
    take('corner_units', R.corner_units())
    take('great_room_planter', R.great_room_planter())
    take('great_room_sofa', R.great_room_sofa())
    take('rocking_chair',
         R.rocking_chair(13080, 3500, face=(10123 - 13080, 3932 - 3500)))
    take('armchair', R.armchair(13800, 5050, (11640 - 13800, 4400 - 5050)))
    take('console_top', R.console_top())

    COUNTED = ('solid', 'wood', 'soft', 'green', 'water')
    MIN_AREA = 0.02e6                      # mm²
    fails = []
    for name, p in drawn:
        style = p[-1]
        if style not in COUNTED:
            continue
        piece = C.blank()
        if p[0] == 'poly':
            xs = [q[0] for q in p[1]]
            ys = [q[1] for q in p[1]]
            if (max(xs) - min(xs)) * (max(ys) - min(ys)) < MIN_AREA:
                continue
            C.put_poly(piece, p[1])
        elif p[0] == 'rect':
            if abs((p[3] - p[1]) * (p[4] - p[2])) < MIN_AREA:
                continue
            C.put_rect(piece, min(p[1], p[3]), min(p[2], p[4]),
                       max(p[1], p[3]), max(p[2], p[4]))
        elif p[0] == 'circle':
            if style == 'green':
                continue   # foliage — crowns and shrubs overhang their beds
            if math.pi * p[3] * p[3] < MIN_AREA:
                continue
            C.put_disc(piece, p[1], p[2], p[3])
        else:
            continue
        total = int(piece.sum())
        if not total:
            continue
        covered = int((piece & mask).sum())
        if covered / total < 0.7:
            fails.append(f'  {name}: {p[0]} {style} covered '
                         f'{100 * covered / total:.0f} %')
    if fails:
        print('COVERAGE AUDIT FAILED — drawn in 2D, missing from the export:')
        print('\n'.join(sorted(set(fails))))
        sys.exit(1)
    print(f'coverage audit: every drawn piece is exported '
          f'({len(drawn)} prims checked)')


def copy_sheet():
    """The CAD review sheet, verbatim.  The 2D tab shows THIS, so what the
    family sees in the app is pixel-for-pixel the drawing the DXF ships with."""
    import shutil
    # each home names its own sheet in home.json, relative to CAD/
    cad_root = os.path.abspath(os.path.join(args.cad, '..'))
    src = os.path.join(cad_root, home.meta().get('sheet',
                                                 'drawings/07-round1-layout.svg'))
    dst_dir = OUT      # the sheet lives with the home's data
    os.makedirs(dst_dir, exist_ok=True)
    shutil.copyfile(src, os.path.join(dst_dir, 'plan-sheet.svg'))
    print(f'copied plan-sheet.svg from {os.path.relpath(src, cad_root)}')


if __name__ == '__main__':
    fixtures_ts = emit_fixtures()          # fills STACK_POS
    furniture_ts = emit_furniture()
    audit_coverage()                       # refuses to ship an incomplete 3D
    open(os.path.join(OUT, 'building.ts'), 'w').write(emit_building())
    open(os.path.join(OUT, 'fixtures.ts'), 'w').write(fixtures_ts)
    open(os.path.join(OUT, 'furniture.ts'), 'w').write(furniture_ts)
    copy_sheet()
    print('wrote building.ts, fixtures.ts, furniture.ts')
