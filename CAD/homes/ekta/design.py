"""
EKTA'S FLAT — 14th floor, Neeldhara. Next door to Om Neeldhara.

THIS FILE IS THE DESIGN. It started as the output of homes/ekta/import.py —
every number below was read off the builder's DWG and every room checked
against his own dimension text — and from here it is hand-edited, the way
Om Neeldhara's design.py is.

    import.py                the record of what the BUILDER drew. Re-running
                             it now needs --force; `--to design.imported.py`
                             writes a fresh copy of his plan to diff against.
    design.imported.py       that copy, frozen at handover.

    RERA        1073 sq ft  =  carpet 1032 + balcony 41
    carpet      95.83 m2 (1032 sq ft) — his figure exactly
    balcony     3.75 m2 (40 sq ft)
    envelope    107.68 m2 (1159 sq ft) to the outer face
    frame       the flat's north-west corner is (0, 0); x east, y SOUTH, so
                the sheet reads the same way up as the DWG

This is the flat AS THE BUILDER HANDS IT OVER — geometry with no reasoning
behind it, because a DWG carries no intent. Om Neeldhara's design.py reads
the other way round: every number there has a comment saying why. That is
what this file becomes when somebody starts designing the flat.
"""

# --------------------------------------------------------------- the shell
# Outer face of the external walls: the floor plate (carpet + balcony) pushed
# out by one 150 wall.
ENVELOPE = [
    (-150, -150), (3200, -150), (3200, 470), (8295, 470), (8295, -150), (11620, -150),
    (11620, 8505), (8295, 8505), (8295, 7895), (6950, 7895), (6950, 12470), (3650, 12470),
    (3650, 11070), (455, 11070), (455, 9550), (2145, 9550), (2145, 4270), (-150, 4270)
]

# The RERA carpet boundary exactly as drawn, measured to the inside faces.
CARPET = [
    (0, 0), (3050, 0), (3050, 620), (8445, 620), (8445, 0), (11470, 0), (11470, 8355),
    (8445, 8355), (8445, 7745), (6800, 7745), (6800, 11070), (3800, 11070), (3800, 10920),
    (605, 10920), (605, 9700), (2295, 9700), (2295, 4120), (0, 4120)
]

# The balcony slab. RERA counts it separately from the carpet.
BALCONY = [(3800, 11070), (6800, 11070), (6800, 12320), (3800, 12320)]

# Carpet + balcony as one polygon: the floor you can stand on. Everything
# between this and ENVELOPE is external wall.
PLATE = [
    (0, 0), (3050, 0), (3050, 620), (8445, 620), (8445, 0), (11470, 0), (11470, 8355),
    (8445, 8355), (8445, 7745), (6800, 7745), (6800, 11070), (6800, 12320), (3800, 12320),
    (3800, 11070), (3800, 10920), (605, 10920), (605, 9700), (2295, 9700), (2295, 4120),
    (0, 4120)
]

# ------------------------------------------------------------- the walls
# (x1, y1, x2, y2, thickness, openings, kind, id, note, bow)
#
# BOW is the whole idea of this plan. It is the wall's sagitta in mm — how far
# the middle of it stands off the straight line between its ends, positive to
# the LEFT of the direction of travel. Nothing else changes: a bowed wall has
# the same two endpoints as a straight one, so it meets its neighbours exactly
# where a straight wall would and the plan still closes.
#
# Where the bows are is the argument. Every wall that faces the living room
# bows into it and carries an arched opening; every wall that only divides two
# private rooms is straight. So the public room is read as a sequence of
# arches and apses, and the private ones stay square and easy to furnish.
#
# Openings are (type, from, to) in absolute mm along the wall.
NEW_WALLS = [
    # --- north-west: the guest room
    (3125, -75, 3125, 4195, 125, [], 'partition', 'W-GUEST-E',
     'guest room and study | kitchen. Blind: the kitchen runs its tall units '
     'up this side and the bedroom puts its wardrobe against the same line.', 0),
    (2220, 4195, 3125, 4195, 125, [('door', 2270, 3070)], 'partition', 'W-GUEST-S',
     "guest room | living. The room's only door, off the living room's "
     'north-west corner — there is no hall left to enter it from.', 0),

    # --- the kitchen, the whole width of the north band
    (6875, 545, 6875, 4195, 125, [], 'partition', 'W-KIT-E',
     'kitchen | bath and utility', 0),
    (3125, 4195, 6875, 4195, 125, [('arch', 3900, 6200)], 'partition', 'W-KIT-S',
     'kitchen | dining. The counter line, bowed into the room, with a 2300 arch '
     'over it: from the sofa the kitchen is a lit alcove, not a doorway.', 550),

    # --- the second bathroom, on the shaft the builder drained a toilet into
    (8370, 545, 8370, 4195, 125, [], 'partition', 'W-GBATH-E',
     "bath and utility | family bedroom. Blind on the bedroom side — the "
     "child's wardrobe backs onto it.", 0),
    (6875, 4195, 8370, 4195, 125, [('door', 7300, 8100)], 'partition', 'W-GBATH-S',
     'bath and utility | vestibule', 0),

    # --- the vestibule: the arched threshold into the family wing
    (6875, 4195, 6875, 5600, 125, [('arch', 4450, 5350)], 'partition', 'W-VEST-W',
     'living | vestibule. Bows west into the living room.', 320),
    (8370, 4195, 8370, 5600, 125, [('arch', 4450, 5350)], 'partition', 'W-VEST-E',
     'vestibule | family bedroom. Bows east, so the two arches face each other '
     'across a room that is wider in the middle than at either end.', 320),

    # --- the family bathroom
    (6875, 5600, 8370, 5600, 125, [], 'partition', 'W-FBATH-N',
     'vestibule | family bath', 0),
    (6875, 5600, 6875, 7820, 125, [], 'partition', 'W-FBATH-W',
     'living | family bath', 0),
    (8370, 5600, 8370, 7820, 125, [('door', 6100, 6900)], 'partition', 'W-FBATH-E',
     'family bath | family bedroom. Entered from the bedroom, never from the '
     'vestibule.', 0),

    # --- the way in
    (2220, 9625, 2220, 10995, 125, [('arch', 9875, 10725)], 'partition', 'W-FOYER-E',
     'foyer | living. Bows into the foyer, so the front door opens onto a curve '
     'rather than into the side of the sofa.', -250),

    # --- the balcony line: an opening, not a wall
    (3725, 10995, 6875, 10995, 0, [], 'threshold', 'T-BALC',
     'living | balcony — the sliding door', 0),
]

# ------------------------------------------------------------------ screens
# (x1, y1, x2, y2, bow, height, id, name, note)
#
# A SCREEN IS NOT A WALL. It stops short of the 3050 ceiling and it takes no
# part in deciding what a room is, so the family bedroom stays ONE room in the
# model — which is the truth of it, and the whole point of the brief.
SCREENS = [
    (9200, 4195, 11545, 4195, 550, 2100, 'S-KID', "the kid's section",
     "A curved screen 2100 high in a 3050 room, open for 830 mm at its west "
     "end. It gives the kid a bed, a desk and the north window to himself "
     "without making a second bedroom out of it: over the top the ceiling runs "
     "through, and from the doorway you see both ends at once. It bows south, "
     "into the adults' end, so his side is the squarer of the two and their bed "
     "gets a curved head wall to stand against."),
]

# ------------------------------------------------------- openings in the shell
# (x1, y1, x2, y2, type, id, note) — endpoints on the OUTER face of the
# envelope. The external walls are derived from that outline, so an opening in
# one is authored against it rather than against a wall of ours.
EXTERIOR_OPENINGS = [
    (455, 9700, 455, 10920, 'door', 'D-ENTRY',
     "the front door, 1220 (4'-0\") — where the builder put it, and it does not "
     'move: the lobby beyond is common property.'),
]

# ------------------------------------------------------------- glazing
# Window runs on DA_WINDOW, as drawn.
GLAZING = [
    (80, -150, 3050, -150, 'window'),
    (8445, -150, 11470, -150, 'window'),
    (80, -90, 3050, -90, 'window'),
    (8445, -90, 11470, -90, 'window'),
    (80, -60, 3050, -60, 'window'),
    (8445, -60, 11470, -60, 'window'),
    (80, 0, 3050, 0, 'window'),
    (8445, 0, 11470, 0, 'window'),
    (3485, 470, 4235, 470, 'window'),
    (5035, 470, 6435, 470, 'window'),
    (7235, 470, 7985, 470, 'window'),
    (3485, 530, 4235, 530, 'window'),
    (5035, 530, 6435, 530, 'window'),
    (7235, 530, 7985, 530, 'window'),
    (3485, 560, 4235, 560, 'window'),
    (5035, 560, 6435, 560, 'window'),
    (7235, 560, 7985, 560, 'window'),
    (3485, 620, 4235, 620, 'window'),
    (5035, 620, 6435, 620, 'window'),
    (7235, 620, 7985, 620, 'window'),
    (7235, 7745, 7985, 7745, 'window'),
    (7235, 7805, 7985, 7805, 'window'),
    (7235, 7835, 7985, 7835, 'window'),
    (8525, 8355, 11470, 8355, 'window'),
    (8525, 8415, 11470, 8415, 'window'),
    (8525, 8445, 11470, 8445, 'window'),
    (2295, 10920, 3495, 10920, 'window'),
    (3885, 10920, 6720, 10920, 'window'),
    (2295, 10980, 3495, 10980, 'window'),
    (3885, 10980, 6720, 10980, 'window'),
    (2295, 11010, 3495, 11010, 'window'),
    (3885, 11010, 6720, 11010, 'window'),
    (3885, 11070, 6720, 11070, 'window'),
]

# --------------------------------------------------------------- rooms
# name, subtitle, anchor, note. NO SHAPES: every polygon is derived from the
# walls above, so an anchor is all a room needs. The builder's dimension text
# is gone from these because they are no longer his rooms.
#
# THE BRIEF: two adults and a child. That is one bedroom, not three — so the
# whole east block becomes a single family room with the child's end screened
# off inside it, and the two bedrooms the builder drew in the middle of the
# plan give their space back to the living room and the kitchen.
ROOMS = [
    ('GUEST / STUDY', '', (1500, 2000),
     'the one spare room: a desk under the north window, a bed for visitors'),
    ('KITCHEN', '', (5000, 2300),
     'the whole north band, two windows, open to the dining across a bowed counter'),
    ('BATH & UTILITY', 'COMMON', (7620, 2300),
     "the builder's toilet position, on its shaft — bath, washing machine and store"),
    ('FAMILY BEDROOM', '', (9950, 2200),
     "one room for all three: the adults south, the child's end north behind a "
     'curved screen, a window at each end'),
    ('VESTIBULE', '', (7620, 4900),
     'the arched threshold into the family wing, and the way to the common bath'),
    ('BATH', 'FAMILY', (7620, 6700), 'on the south-east shaft, entered from the bedroom'),
    ('LIVING / DINING', '', (4400, 7500),
     'one room from the front door to the balcony, read through three arches'),
    ('FOYER', '', (1375, 10300), 'the way in'),
    ('BALCONY', '', (5300, 11700), 'off the living room'),
]

# Loose furniture: nothing yet. This flat has not been designed.
FURNITURE = []
