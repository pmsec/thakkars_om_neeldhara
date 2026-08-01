/**
 * Loose furniture, ported from floor-plan-source.py.
 *
 * Kept in its own file and its own layer on purpose (brief §4): the architect switches
 * it off with one toggle, and it takes no part in any dimensional-integrity check. The
 * integrity suite asserts that separation rather than trusting it.
 *
 * Plumbed and fitted items (sanitaryware, kitchen counters, the pantry bar) are NOT
 * here — they are building fabric and live in `fixtures.ts`.
 *
 * Geometry convention: `x, y` is the top-left of the plan footprint, `w × d` its size,
 * matching the `fbox(x, y, w, h)` calls in the Python source. Items the source placed by
 * centre (beds, armchairs, dining tables) have been converted.
 */

export type FurnitureKind =
  | 'sofa'
  | 'bed'
  | 'daybed'
  | 'armchair'
  | 'table'
  | 'console'
  | 'bench'
  | 'stool'
  | 'lounger'
  | 'rug'
  | 'plant'
  | 'tree'
  | 'shelves'
  | 'dining'
  | 'drumkit'
  | 'guitar'
  | 'stair'
  | 'wardrobe'

export interface FurnitureItem {
  id: string
  kind: FurnitureKind
  x: number
  y: number
  w: number
  d: number
  /** Which way a seat or bed head faces. */
  face?: 'N' | 'S' | 'E' | 'W'
  room: string
  label: string
  /** Height above floor, for the 3D view. */
  height: number
  /** Dining tables only: chairs per long side, per short side. */
  seats?: [number, number]
}

const F = (
  id: string,
  kind: FurnitureKind,
  x: number,
  y: number,
  w: number,
  d: number,
  room: string,
  label: string,
  height: number,
  extra: Partial<FurnitureItem> = {},
): FurnitureItem => ({ id, kind, x, y, w, d, room, label, height, ...extra })

export const furniture: FurnitureItem[] = [
  // --------------------------------------------------------- trees in the edge cages
  // These stand OUTSIDE the envelope, in the metal cages that project past the slab and
  // carry the foot of the canopy glass. They are planting, not fabric, so they live here
  // with the rest of the loose items and switch off with them. `room` records which space
  // each one fronts; it is not a claim that the tree is inside that room.
  //
  // Heights are checked against the canopy in `canopy.test.ts` — a tree that would grow
  // into the glass fails the build rather than being discovered on site.
  // 1300 wide inside a 1500 cage, so the crown clears the glass on both sides.
  ...[5300, 7800, 10300, 12800, 15300, 17800].map((cx, i) =>
    F(`FN-TREE-D${i + 1}`, 'tree', cx - 650, -1400, 1300, 1300, 'R-DECK', 'Tree in the deck-edge cage', 3400),
  ),
  ...[900, 2300].map((cx, i) =>
    F(`FN-TREE-P${i + 1}`, 'tree', cx - 600, -1350, 1200, 1200, 'R-P-TERRACE', 'Tree in the terrace cage', 2800),
  ),
  ...[22180, 23580].map((cx, i) =>
    F(`FN-TREE-K${i + 1}`, 'tree', cx - 600, -1350, 1200, 1200, 'R-K-TERRACE', 'Tree in the terrace cage', 2800),
  ),

  // ------------------------------------------------------------------ all-weather deck
  F('FN-DECK-RUG', 'rug', 5250, 1000, 2650, 1450, 'R-DECK', 'Outdoor rug', 12),
  F('FN-DECK-SOFA', 'sofa', 5450, 1150, 2250, 780, 'R-DECK', 'Deck sofa', 750, { face: 'S' }),
  F('FN-DECK-AC1', 'armchair', 5770, 1770, 760, 760, 'R-DECK', 'Deck armchair', 800),
  F('FN-DECK-AC2', 'armchair', 6820, 1770, 760, 760, 'R-DECK', 'Deck armchair', 800),
  F('FN-DECK-CT', 'table', 6300, 1980, 940, 560, 'R-DECK', 'Coffee table', 380),
  F('FN-DECK-LG1', 'lounger', 11150, 1180, 600, 1300, 'R-DECK', 'Sun lounger', 420),
  F('FN-DECK-LG2', 'lounger', 11850, 1180, 600, 1300, 'R-DECK', 'Sun lounger', 420),
  F('FN-DECK-ST', 'table', 12620, 1500, 620, 620, 'R-DECK', 'Side table', 480),
  F('FN-DECK-DIN', 'dining', 16250, 925, 1800, 950, 'R-DECK', 'Outdoor dining, 8 seats', 750, { seats: [3, 1] }),
  F('FN-DECK-P1', 'plant', 4745, 115, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P2', 'plant', 8385, 165, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P3', 'plant', 7365, 145, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P4', 'plant', 16565, 165, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P5', 'plant', 19245, 115, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P6', 'plant', 13365, 145, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P7', 'plant', 11165, 2065, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P8', 'plant', 10015, 2065, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P9', 'plant', 6065, 2065, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P10', 'plant', 17865, 2065, 470, 470, 'R-DECK', 'Planter', 900),
  F('FN-DECK-P11', 'plant', 15415, 2025, 470, 470, 'R-DECK', 'Planter', 900),

  // Building stairs sitting inside the two lift cores.
  F('FN-STAIR-W', 'stair', 9390, 1230, 970, 1180, 'R-CORE-W', 'Building stair, down', 0),
  F('FN-STAIR-E', 'stair', 14120, 1230, 970, 1180, 'R-CORE-E', 'Building stair, down', 0),

  // ------------------------------------------------------------- parents' master suite
  F('FN-P-RUG', 'rug', 620, 5400, 2320, 2400, 'R-P-SUITE', 'Bedroom rug', 12),
  F('FN-P-BED', 'bed', 1020, 5685, 2000, 1830, 'R-P-SUITE', 'King bed', 550, { face: 'E' }),
  F('FN-P-DRESSER', 'console', 200, 7700, 1150, 620, 'R-P-SUITE', 'Dresser', 800),
  F('FN-P-AC', 'armchair', 1800, 1170, 700, 700, 'R-P-SUITE', 'Armchair', 800),
  F('FN-P-DAYBED', 'daybed', 300, 2100, 900, 1900, 'R-P-SUITE', "Day bed — grandmother's visits", 500),
  F('FN-P-DAYBED-ST', 'table', 1330, 2480, 560, 460, 'R-P-SUITE', 'Side table', 480),
  F('FN-P-PLANT', 'plant', 2615, 3385, 430, 430, 'R-P-SUITE', 'Planter', 900),

  // ---- parents' wardrobe / dressing joinery
  F('FN-P-SH1', 'shelves', 3270, 6070, 420, 2230, 'R-P-WARDROBE', 'Wardrobe shelving', 2100),
  F('FN-P-SH2', 'shelves', 4260, 6070, 420, 2230, 'R-P-WARDROBE', 'Wardrobe shelving', 2100),

  // ---- parents' family room
  F('FN-PF-RUG', 'rug', 5080, 3700, 2450, 1150, 'R-P-FAMILY', 'Rug', 12),
  F('FN-PF-SOFA', 'sofa', 5320, 3960, 2050, 820, 'R-P-FAMILY', 'Sofa', 750, { face: 'N' }),
  F('FN-PF-CONSOLE', 'console', 4820, 2740, 380, 1400, 'R-P-FAMILY', 'Console', 800),
  F('FN-PF-P1', 'plant', 7310, 2960, 380, 380, 'R-P-FAMILY', 'Planter', 900),
  F('FN-PF-P2', 'plant', 7255, 4425, 390, 390, 'R-P-FAMILY', 'Planter', 900),

  // ---- parents' pod hall, with the pooja niche
  F('FN-PH-CONSOLE', 'console', 4830, 7760, 1300, 420, 'R-P-HALL', 'Console', 800),
  F('FN-PH-AC', 'armchair', 4920, 5950, 800, 800, 'R-P-HALL', 'Armchair', 800),
  F('FN-PH-PLANT', 'plant', 6090, 6160, 520, 520, 'R-P-HALL', 'Planter', 900),
  F('FN-PH-POOJA', 'console', 5960, 8020, 640, 290, 'R-P-HALL', 'Pooja niche', 1100),

  // ------------------------------------------------------------------------ great room
  F('FN-GR-RUG', 'rug', 9880, 2880, 4720, 2500, 'R-GREAT', 'Living rug', 12),
  F('FN-GR-SOFA', 'sofa', 10590, 4180, 3300, 950, 'R-GREAT', 'Sofa, 4 seat', 750, { face: 'N' }),
  F('FN-GR-CT', 'table', 11340, 3010, 1800, 820, 'R-GREAT', 'Coffee table', 380),
  F('FN-GR-AC1', 'armchair', 9470, 2910, 820, 820, 'R-GREAT', 'Armchair', 800),
  F('FN-GR-AC2', 'armchair', 13690, 2910, 820, 820, 'R-GREAT', 'Armchair', 800),
  F('FN-GR-DIN', 'dining', 11040, 6850, 2400, 1000, 'R-GREAT', 'Dining table, 8 seats', 750, { seats: [3, 1] }),
  F('FN-GR-CONSOLE', 'console', 8620, 8060, 1250, 300, 'R-GREAT', 'Console', 800),
  F('FN-GR-AC3', 'armchair', 7690, 6540, 820, 820, 'R-GREAT', 'Armchair', 800),
  F('FN-GR-AC4', 'armchair', 15970, 6540, 820, 820, 'R-GREAT', 'Armchair', 800),
  F('FN-GR-ST1', 'table', 7850, 7500, 540, 540, 'R-GREAT', 'Side table', 480),
  F('FN-GR-ST2', 'table', 16090, 7500, 540, 540, 'R-GREAT', 'Side table', 480),

  // ------------------------------------------------------------- Karan's music + work den
  F('FN-KD-STOOL1', 'stool', 17240, 2760, 400, 460, 'R-K-DEN', 'Bar stool', 700),
  F('FN-KD-STOOL2', 'stool', 17740, 2760, 400, 460, 'R-K-DEN', 'Bar stool', 700),
  F('FN-KD-SOFA', 'sofa', 16960, 3950, 2050, 830, 'R-K-DEN', 'Working couch', 750, { face: 'N' }),
  F('FN-KD-DRUMS', 'drumkit', 18300, 3560, 1560, 1240, 'R-K-DEN', 'Electronic drum kit', 900),
  F('FN-KD-GUITAR', 'guitar', 19200, 2660, 540, 800, 'R-K-DEN', 'Guitar stands', 1000),

  // ---- Karan's pod hall
  F('FN-KH-RUG', 'rug', 17020, 5000, 2450, 1650, 'R-K-HALL', 'Rug', 12),
  F('FN-KH-CONSOLE', 'console', 17320, 5950, 1300, 420, 'R-K-HALL', 'Console', 800),
  F('FN-KH-AC', 'armchair', 17700, 5900, 800, 800, 'R-K-HALL', 'Armchair', 800),
  F('FN-KH-PLANT', 'plant', 17465, 6815, 470, 470, 'R-K-HALL', 'Planter', 900),

  // ---- gear store
  F('FN-KG-SH1', 'shelves', 18520, 7020, 340, 1260, 'R-K-GEAR', 'Gear shelving', 2100),
  F('FN-KG-SH2', 'shelves', 19350, 7020, 340, 1260, 'R-K-GEAR', 'Gear shelving', 2100),

  // ---- Karan's wardrobe joinery
  F('FN-K-SH1', 'shelves', 19810, 6070, 420, 2230, 'R-K-WARDROBE', 'Wardrobe shelving', 2100),
  F('FN-K-SH2', 'shelves', 20800, 6070, 420, 2230, 'R-K-WARDROBE', 'Wardrobe shelving', 2100),

  // ------------------------------------------------------------- Karan's master suite
  F('FN-K-RUG', 'rug', 21540, 5400, 2320, 2400, 'R-K-SUITE', 'Bedroom rug', 12),
  F('FN-K-BED', 'bed', 21460, 5685, 2000, 1830, 'R-K-SUITE', 'King bed', 550, { face: 'W' }),
  F('FN-K-DRESSER', 'console', 23130, 7700, 1150, 620, 'R-K-SUITE', 'Dresser', 800),
  F('FN-K-DESK', 'console', 22400, 1500, 1500, 700, 'R-K-SUITE', 'Desk', 750),
  F('FN-K-AC', 'armchair', 23170, 2170, 700, 700, 'R-K-SUITE', 'Armchair', 800),
  F('FN-K-PLANT', 'plant', 21385, 2185, 430, 430, 'R-K-SUITE', 'Planter', 900),

  // ---------------------------------------------------------------- sealed service zone
  F('FN-HELP-BED', 'bed', 3700, 8950, 900, 1800, 'R-HELP', "Help's bed, live-in", 550, { face: 'N' }),
  F('FN-HELP-SH', 'shelves', 4700, 8560, 330, 900, 'R-HELP', 'Shelving', 2100),
  F('FN-HELP-WR', 'wardrobe', 3290, 8560, 400, 900, 'R-HELP', 'Wardrobe', 2100),
  F('FN-STORE-SH1', 'shelves', 7760, 9300, 360, 1420, 'R-STORE', 'Store shelving', 2100),
  F('FN-STORE-SH2', 'shelves', 8460, 9300, 360, 1420, 'R-STORE', 'Store shelving', 2100),
  F('FN-VEST-SH', 'shelves', 12310, 8520, 320, 880, 'R-SVC-VEST', 'Shelving', 2100),
  F('FN-VEST-BENCH', 'bench', 12300, 10250, 930, 400, 'R-SVC-VEST', 'Bench', 450),

  // ------------------------------------------------------------------- entry gallery
  F('FN-EG-RUG', 'rug', 15180, 9120, 2650, 1400, 'R-ENTRY', 'Entry rug', 12),
  F('FN-EG-CONSOLE', 'console', 14790, 8520, 360, 1550, 'R-ENTRY', 'Console', 800),
  F('FN-EG-BENCH', 'bench', 17420, 8480, 1080, 380, 'R-ENTRY', 'Bench', 450),
  F('FN-EG-AC', 'armchair', 14760, 9910, 720, 720, 'R-ENTRY', 'Armchair', 800),
  F('FN-EG-P1', 'plant', 17970, 10070, 500, 500, 'R-ENTRY', 'Planter', 900),
  F('FN-EG-P2', 'plant', 14765, 8595, 450, 450, 'R-ENTRY', 'Planter', 900),
]
