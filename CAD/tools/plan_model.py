"""
Plan A-101 rev 101, transcribed from the plan's own matplotlib source.

The plan's model coordinates and the frame in frame.py are the same system:
X 0 = the left outer wall centreline, Y 0 = the deck parapet centreline,
Y increases towards the entrance.  So nothing needs converting - the numbers
below are lifted straight out of the drawing script.

Walls are stored as centrelines plus a thickness, exactly as the plan's
wall() helper draws them.
"""

import numpy as np

T_EXT, T_INT, T_THIN = 240, 150, 110

# ------------------------------------------------------------------ envelope
OUTLINE = [(0, 200), (4730, 200), (4730, 0), (19750, 0), (19750, 200),
           (24480, 200), (24480, 9370), (19750, 9370), (19750, 10850),
           (4730, 10850), (4730, 9370), (0, 9370)]

# ------------------------------------------------------------------ floors
# (name, x, y, w, h) - every floor() call that lays a room down.
FLOORS = [
    ('all-weather deck',        4730,    0, 15020, 2620),
    ("parents' terrace",           0,  200,  3200, 1100),
    ("karan's terrace",        21280,  200,  3200, 1100),
    ("parents' sealed shaft",   3200,  200,  1530, 1350),
    ("karan's sealed shaft",   19750,  200,  1530, 1350),
    ("parents' master suite",      0, 1300,  3200, 8070),
    ("parents' suite band",     3200, 1550,  1530, 6200),
    ("parents' wardrobe",          0, 7750,  4730, 1620),
    ("parents' pod",            4730, 2620,  4460, 5780),
    ('great room',              8395, 2620,  7690, 5780),
    ("karan's pod",            15290, 2620,  4460, 5780),
    ("karan's suite band",     19750, 1550,  1530, 6200),
    ("karan's wardrobe",       19750, 7750,  4730, 1620),
    ("karan's master suite",   21280, 1300,  3200, 8070),
    ("parents' bath",           4730, 8400,  2100, 2450),
    ('kitchen',                 6830, 8400,  3900, 2450),
    ('laundry + store',        10730, 8400,  2895, 2450),
    ('east pockets',           13625, 8400,  1225, 2450),
    ("help's room",            14850, 8400,  1500, 2450),
    ('guest / service WC',     16350, 8400,  1300, 2450),
    ("karan's bath",           17650, 8400,  2100, 2450),
]
GALLERY = (13625, 9625, 1225)          # round entry gallery: cx, cy, r

# The two voids the plan draws as retained holes in the deck.
PLAN_VOIDS = [("plan void, west", 7605, 1270, 1585, 1350),
              ("plan void, east", 15290, 1270, 1585, 1350)]

# ------------------------------------------------------------------ walls
# (x1, y1, x2, y2, thickness, [(from, to) openings measured along the wall])
WALLS = [
    # void enclosures
    *[w for vx in (7605, 15290) for w in (
        (vx, 1270, vx + 1585, 1270, T_INT, []),
        (vx, 1270, vx, 2620, T_INT, []),
        (vx + 1585, 1270, vx + 1585, 2620, T_INT, []),
        (vx, 2620, vx + 1585, 2620, T_INT, []))],
    # parents wing
    (3200, 200, 3200, 9370, T_INT, [(1350, 9170)]),
    (3200, 1550, 4730, 1550, T_INT, []),
    (4730, 200, 4730, 9370, T_INT, [(3100, 5900), (8500, 9100)]),
    (4730, 8400, 8395, 8400, T_INT, [(2150, 3350)]),
    # great room south wall
    (8395, 8400, 16085, 8400, T_INT, [(4705, 5605)]),
    # karan wing
    (21280, 200, 21280, 9370, T_INT, [(1350, 9170)]),
    (19750, 1550, 21280, 1550, T_INT, []),
    (19750, 200, 19750, 9370, T_INT, [(3100, 5900), (8500, 9100)]),
    (16085, 8400, 19750, 8400, T_INT, [(315, 1015)]),
    # east bay
    (6830, 8400, 6830, 10850, T_INT, []),
    (10730, 8400, 10730, 10850, T_INT, [(300, 1100)]),
    (12400, 9625, 12400, 10850, T_INT, [(75, 825)]),
    (14850, 9625, 14850, 10850, T_INT, [(75, 825)]),
    (16350, 8400, 16350, 10850, T_THIN, [(1100, 1900)]),
    (17650, 8400, 17650, 10850, T_INT, []),
]
# arcwall(13625, 9625, 1225, [(180, 244), (288, 360)]) - the gallery's curved head
ARCWALL = (13625, 9625, 1225, [(180, 244), (288, 360)], T_INT)

# ------------------------------------------------------------------ openings
# Things that must land on solid buildable line - doors, windows, sliders.
OPENINGS = [
    ('service entry door',   11150, 10850, 11950, 10850),
    ('main entrance door',   13175, 10850, 14075, 10850),
    ('entry gallery arch',   13100,  8400, 14000,  8400),
    ('kitchen serving hatch', 6880,  8400,  8080,  8400),
    ('great room -> WC',     16400,  8400, 17100,  8400),
    ("parents' window W1",       0,  2200,     0,  3800),
    ("parents' window W2",       0,  4600,     0,  6400),
    ("parents' window W3",       0,  7100,     0,  9000),
    ("parents' bed window",    400,  9370,  2400,  9370),
    ("karan's window E1",    24480,  2200, 24480,  3800),
    ("karan's window E2",    24480,  4600, 24480,  6400),
    ("karan's window E3",    24480,  7100, 24480,  9000),
    ("parents' bath window",  5000, 10850,  6400, 10850),
    ('kitchen window',        7300, 10850,  9700, 10850),
    ("help's room window",   14500, 10850, 15500, 10850),
    ('WC window',            15900, 10850, 16900, 10850),
    ("karan's bath window",  17300, 10850, 19500, 10850),
]

# ------------------------------------------------------------------ fixtures
# Fixed, plumbed or built-in items whose position cannot simply be nudged.
FIXTURES = [
    ('workout bay on grass',        4870,   470,  7530,  2450),
    ('jacuzzi spa',                17850,   470, 19600,  2220),
    ('fountain',                   11640,   710, 12840,  1910),
    ('west 2-seat recliner',        9265,  1290, 10215,  2600),
    ('east 2-seat recliner',       14265,  1290, 15215,  2600),
    ("parents' kitchen run",        6890,  8460, 10670,  9020),
    ('kitchen peninsula + hob',     6890,  9940, 10010, 10740),
    ('tall fridge',                 9970, 10040, 10670, 10740),
    ('washer + dryer stack',       10800,  9840, 11500, 10540),
    ("parents' bath vanity",        5380,  8480,  6730,  8980),
    ("parents' bath shower",        5855,  9875,  6755, 10775),
    ("karan's bath vanity",        17750,  8480, 19100,  8980),
    ("karan's bath shower",        17725,  9875, 18625, 10775),
    ('guest WC shower',            16440,  8480, 17560,  9280),
    ("help's room bunk",           14975,  8485, 15875, 10385),
    # the two curvedpiece() calls in the gallery, swept to their bounding boxes
    ('entry gallery console',      12492,  8583, 13308,  9495),
    ('entry gallery bench',        13767,  8514, 14770,  9577),
    ("parents' bed",                 960,  6975,  2960,  8775),
    ("karan's bed",                22030,  7250, 23830,  9250),
    ('murphy bed nook',                0,  2350,  2000,  3720),
]
