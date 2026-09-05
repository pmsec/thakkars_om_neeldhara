/**
 * Om Neeldhara, floor 14 — the home this app was built for.
 *
 * `checks` names the integrity checks that are ASSERTIONS ABOUT THIS HOME
 * rather than universal geometry: this flat is two wings mirrored about
 * x 12240, with curved pod screens of a known span. A home without those
 * properties simply omits them, and the suite skips them for that home
 * instead of failing.
 */

import type { HomeMeta } from '../types'

export const meta: HomeMeta = {
  id: 'om-neeldhara',
  name: 'Om Neeldhara — Floor 14',
  subtitle: 'DWG A-101 · Round 1 (CAD branch) · August 2026',
  origin: 'authored',
  checks: {
    mirrorAbout: 12240,
    expectedEnvelope: true,
    curvedScreens: true,
    knownClashes: true,
    brief: true,
  },
  cameras: 'om-neeldhara',
}
