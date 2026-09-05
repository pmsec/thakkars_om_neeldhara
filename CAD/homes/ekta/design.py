"""
EKTA'S FLAT — 14th floor, Neeldhara. Next door to Om Neeldhara.

IMPORTED, not yet authored. Every number below was read out of the builder's
DWG by tools/import_shell.py: the walls are the two faces of each drawn wall
paired into a centreline, the columns are the rectangles on DA_COLUMN, and
the envelope is the RERA carpet boundary offset out by one wall.

    RERA        1073 sq ft  =  carpet 1032 + balcony 41
    carpet      95.83 m2 (1032 sq ft) — matches the builder's figure
    local frame the flat's north-west corner is (0, 0); x runs east, y south

This is the flat AS THE BUILDER HANDS IT OVER. It is deliberately thin: rows
of coordinates with no reasoning behind them, because a DWG carries geometry
and not intent. Home 1's design.py reads the other way round — every number
there has a comment saying why. That is what this file becomes as we work on
it: the first thing to do is give these coordinates names.
"""

# --------------------------------------------------------------- the shell
# Outer face of the external walls: the carpet boundary pushed out by 150.
ENVELOPE = [
    (455, 1250), (3650, 1250), (3650, 1100), (6950, 1100), (6950, 4425), (8295, 4425),
    (8295, 3815), (11620, 3815), (11620, 12470), (8295, 12470), (8295, 11850),
    (3200, 11850), (3200, 12470), (-150, 12470), (-150, 8050), (2145, 8050), (2145, 2770),
    (455, 2770)
]

# The RERA carpet boundary exactly as drawn, kept for checking areas against
# the builder's 1073 sq ft.
CARPET = [
    (605, 2620), (2295, 2620), (2295, 8200), (0, 8200), (0, 12320), (3050, 12320),
    (3050, 11700), (8295, 11700), (8445, 11700), (8445, 12320), (11470, 12320),
    (11470, 3965), (8445, 3965), (8445, 4575), (6800, 4575), (6800, 1400), (6800, 1250),
    (3800, 1250), (3800, 1400), (605, 1400), (605, 2460)
]

BALCONY = [(3800, 0), (6850, 0), (6850, 1250), (3800, 1250)]

# ------------------------------------------------------------- the walls
# (x1, y1, x2, y2, thickness, openings, kind) — centrelines from paired
# faces. 'exterior' walls sit on the envelope and are not clipped to it.
# Openings are empty: door positions are in the DWG as arcs and have not been
# read yet, so every room is currently drawn sealed.
NEW_WALLS = [
    (6875, 4500, 6875, 11775, 125, [], 'partition'),
    (8370, 4500, 8370, 7087, 125, [], 'partition'),
    (4607, 7087, 4607, 11775, 125, [], 'partition'),
    (4607, 7087, 8420, 7087, 125, [], 'partition'),
    (2220, 8125, 4607, 8125, 125, [], 'partition'),
    (3125, 8125, 3125, 11775, 125, [], 'partition'),
    (6875, 8125, 11545, 8125, 125, [], 'partition'),
    (3125, 9162, 4607, 9162, 125, [], 'partition'),
    (6875, 9162, 8370, 9162, 125, [], 'partition'),
    (8370, 9162, 8370, 11775, 125, [], 'partition'),
]

# ------------------------------------------------------------- glazing
# Window runs on DA_WINDOW, as drawn.
GLAZING = [
    (8445, 12320, 11470, 12320, 'window'),
    (11470, 3815, 8525, 3815, 'window'),
    (8525, 3965, 11470, 3965, 'window'),
    (80, 12320, 3050, 12320, 'window'),
    (3485, 11700, 4235, 11700, 'window'),
    (7235, 11700, 7985, 11700, 'window'),
    (5035, 11700, 6435, 11700, 'window'),
    (7235, 4425, 7985, 4425, 'window'),
    (7985, 4575, 7235, 4575, 'window'),
    (3885, 1400, 6720, 1400, 'window'),
    (6720, 1250, 3885, 1250, 'window'),
    (2295, 1250, 3495, 1250, 'window'),
    (3495, 1400, 2295, 1400, 'window'),
    (80, 12410, 3050, 12410, 'window'),
    (3050, 12380, 80, 12380, 'window'),
    (3485, 11790, 4235, 11790, 'window'),
    (4235, 11760, 3485, 11760, 'window'),
    (5035, 11790, 6435, 11790, 'window'),
    (6435, 11760, 5035, 11760, 'window'),
    (7235, 11790, 7985, 11790, 'window'),
    (7985, 11760, 7235, 11760, 'window'),
    (8445, 12410, 11470, 12410, 'window'),
    (11470, 12380, 8445, 12380, 'window'),
    (8525, 3905, 11470, 3905, 'window'),
    (11470, 3875, 8525, 3875, 'window'),
    (7235, 4515, 7985, 4515, 'window'),
    (7985, 4485, 7235, 4485, 'window'),
    (2295, 1340, 3495, 1340, 'window'),
    (3495, 1310, 2295, 1310, 'window'),
    (3885, 1340, 6720, 1340, 'window'),
    (6720, 1310, 3885, 1310, 'window'),
]

# --------------------------------------------------------------- rooms
# name, subtitle, anchor point, note. NO SHAPES: the room polygons are
# derived from the wall centrelines, so an anchor is all a room needs.
ROOMS = [
    ('LIVING / DINING', '', (3901, 5558), 'the long room, with the foyer as its entrance alcove — 14\'9" x 21\'11" as the builder set it out'),
    ('KITCHEN', '', (5325, 9974), '7\' x 11\'11" plus the utility return'),
    ('BEDROOM', '', (1015, 10545), '10\'0" x 13\'6"'),
    ('M.BEDROOM 01', '', (9204, 10550), '10\'0" x 13\'6", with its own toilet'),
    ('M.BEDROOM 02', '', (9065, 6122), '10\'0" x 13\'6", with its own toilet'),
    ('TOILET 01', 'MASTER', (7110, 10530), '4\'6" x 8\'1"'),
    ('TOILET 02', 'MASTER', (7079, 5807), '4\'6" x 8\'0"'),
    ('TOILET', 'COMMON', (3503, 10531), '4\'6" x 8\'1"'),
    ('PASSAGE', '', (3408, 8701), '4\'6" x 2\'11", between the bedroom and the common toilet'),
]

# Loose furniture: nothing yet. This flat has not been designed.
FURNITURE = []
