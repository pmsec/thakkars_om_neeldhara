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
# (x1, y1, x2, y2, thickness, openings, kind, id, note). Openings are
# (type, from, to) in absolute mm along the wall. A wall of thickness 0 and
# kind 'threshold' is an OPENING, not a wall: it divides two rooms and puts
# nothing on the floor.
NEW_WALLS = [
    # NOTHING. Every internal wall and threshold the builder drew has been
    # taken out — this is the bare shell, and the plan is being designed from
    # scratch inside it.
    #
    # What he drew is not lost: design.imported.py holds all eleven partitions,
    # five thresholds and seven doors exactly as they came off the DWG, and
    # `python3 import.py --to design.imported.py` writes a fresh copy any time.
    #
    # The ROOMS below are kept as LABELS ONLY. Their anchors are where his room
    # names sit, so they say what he intended each part of the shell for while
    # the new plan is drawn over it. They name nothing the walls enclose yet.
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
# name, subtitle, anchor, note, the builder's dimension text, its area in
# sq ft. NO SHAPES: a room polygon is derived from the boundaries above, so
# with the walls gone these are LABELS AND NOTHING ELSE — a record of what
# the builder put where, to design against and to argue with.
ROOMS = [
    ('BEDROOM', '', (1015, 1775), '',
     '10\'0"x13\'6"', 135),
    ('TOILET', 'COMMON', (3503, 1789), '',
     '4\'6"x8\'1"', 36),
    ('PASSAGE', 'BEDROOM', (3408, 3619), '',
     '4\'6"x2\'11"', 13),
    ('KITCHEN', '', (5325, 2346), 'open to the living room',
     '7\'0"x11\'11"', 83),
    ('TOILET 01', 'MASTER', (7110, 1790), '',
     '4\'6"x8\'1"', 36),
    ('PASSAGE', 'MASTER 01', (7196, 3619), '',
     '4\'6"x2\'11"', 13),
    ('M.BEDROOM 01', '', (9204, 1770), '',
     '10\'0"x13\'6"', 135),
    ('LIVING / DINING', '', (3901, 6762), 'the foyer is its entrance alcove and the kitchen opens off it',
     '14\'9"x21\'11"', 323),
    ('PASSAGE', 'MASTER 02', (7117, 4619), '',
     '4\'10"x3\'0"', 14),
    ('TOILET 02', 'MASTER', (7079, 6513), 'entered from the bedroom, not the passage',
     '4\'6"x8\'0"', 36),
    ('M.BEDROOM 02', '', (9065, 6198), '',
     '10\'0"x13\'6"', 135),
    ('FOYER', '', (1197, 10209), 'the way in',
     '5\'7"x4\'0"', 22),
    ('BALCONY', '', (4798, 11600), 'off the living room',
     '10\'0"x4\'1"', 41),
]

# Loose furniture: nothing yet. This flat has not been designed.
FURNITURE = []
