"""
What cannot move in Om Neeldhara, floor 14.

The builder's no-floor zones, read off DA_BUILDING LINE and confirmed against
the carpet polygons. West half; the east half is the mirror about X 12240.

This is HOME DATA, not machinery: clash.py holds the raster engine and the
checks, and reads this file for the shapes it must never let a design touch.
Every home has its own copy, extracted from its own source drawing.
"""

# The raster window the checks run in, mm. Sized to this building.
EXTENT = (-1500, -1500, 26000, 13500)

# The mirror line: this flat is two wings about it.
MIRROR_X = 12240


def mirror(z):
    n, a, b, c, d, k = z
    return (n.replace('west', 'east'), 2 * MIRROR_X - c, b, 2 * MIRROR_X - a, d, k)


_WEST = [
    ("sealed shaft, wing end",   2900,    0,  4380, 1200, 'open shaft'),
    # RECLAIMED (Karan's word from the builder): the two retained deck voids
    # are floored and their enclosures come down (the outboard column stands,
    # and the pod wall they backed on to) — open deck now, 'reclaimed void'.
    # Still the builder's zones, still drawn, as a minimal dashed outline and
    # a small note.  (Before this they were 'void store', bulk storage.)
    # zones, still drawn, but Round 1 is allowed a floor and a door in them.
    ("retained deck void",       7730, 1350,  8965, 2470, 'reclaimed void'),
    ("main service duct",        4555, 6175,  5555, 11125, 'open shaft'),
    # RECLAIMED (Karan's call, with the builder's word): the two secondary
    # ducts are not needed as shafts and may be floored — the west one into
    # the kitchen, the east one as the guest / service WC's floor, which is
    # where the builder's own toilet stands.  Still the builder's zones, still
    # drawn, as a minimal dashed outline and a small note.
    ("secondary duct",           5555, 8550,  6900, 9320, 'reclaimed duct'),
]

# The enclosure walls that come down with a reclaimed duct: a builder's shell
# segment with most of its length inside one of these boxes is demolished —
# the west duct's east and south walls, into the kitchen; the east duct's
# NORTH wall, the shower apse opening the WC into the den through it (its
# west and south walls are the WC's and stay).  The east box stops short of
# the main duct wall so that wall's own lines are untouched.
# ...and the deck voids' enclosures: each void's north wall and BOTH stubs
# of its inboard wall — the north one with the north wall, the south one
# (the great room's old jamb) too, Karan's call: the void's corner is open
# to the great room's deck edge.  Its south wall is the pod's own and
# stays; the outboard side is a column.  The east boxes are the west ones
# mirrored.  (The south-stub box is narrow, so the pod wall running through
# it is mostly outside and stands.)
RECLAIM_DEMO = [(5780, 8560, 7060, 9600), (17540, 8390, 18800, 8560),
                (7720, 1190, 9125, 1530), (24480 - 9125, 1190, 24480 - 7720, 1530),
                (8955, 2260, 9125, 2630), (24480 - 9125, 2260, 24480 - 8955, 2630)]

NAMED = ([(n + ', west', a, b, c, d, k) for n, a, b, c, d, k in _WEST]
         + [mirror((n + ', east', a, b, c, d, k)) for n, a, b, c, d, k in _WEST])

# The lift lobby is real floor but common property, not part of either flat.
COMMON = ("lift lobby and landing", 10400, 8550, 14080, 12905)
