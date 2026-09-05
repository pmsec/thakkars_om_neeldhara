"""
What cannot move in Ekta's flat — read off the builder's DWG.

Columns are the rectangles on DA_COLUMN inside the flat. The service shafts
and voids are the S.S. and VOID pockets on the south and east faces. This
flat is NOT mirrored, so there is no mirror line.
"""

EXTENT = (-1500, -1500, 13500, 14500)

MIRROR_X = None


def mirror(z):
    raise NotImplementedError("Ekta's flat is not a mirrored pair")


NAMED = [
    ("column 1", 3049, 10650, 3279, 11550, 'column'),
    ("column 2", -150, 10350, 79, 11550, 'column'),
    ("column 3", 8294, 4425, 8524, 5625, 'column'),
    ("column 4", 8294, 10650, 8524, 11850, 'column'),
    ("column 5", 6719, 3195, 6949, 4425, 'column'),
]

# Common property, not part of the flat: the lift core and staircase to the west.
COMMON = ("lift core and staircase", -6000, 0, -300, 9000)
