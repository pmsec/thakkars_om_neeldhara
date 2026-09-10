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
    # The builder has agreed the two retained deck voids can be floored and
    # used as bulk storage: they are 'void store', not 'void' — still his
    # zones, still drawn, but Round 1 is allowed a floor and a door in them.
    ("retained deck void",       7730, 1350,  8965, 2470, 'void store'),
    ("main service duct",        4555, 6175,  5555, 11125, 'open shaft'),
    ("secondary duct",           5555, 8550,  6900, 9320, 'open shaft'),
]

NAMED = ([(n + ', west', a, b, c, d, k) for n, a, b, c, d, k in _WEST]
         + [mirror((n + ', east', a, b, c, d, k)) for n, a, b, c, d, k in _WEST])

# The lift lobby is real floor but common property, not part of either flat.
COMMON = ("lift lobby and landing", 10400, 8550, 14080, 12905)
