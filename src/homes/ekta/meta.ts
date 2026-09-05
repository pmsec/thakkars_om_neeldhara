/**
 * Ekta's flat — 14th floor, Neeldhara, next door to Om Neeldhara.
 *
 * `origin: 'imported'` says what it is: geometry read out of the builder's
 * DWG, accurate but mute. None of the home-specific checks apply — this flat
 * is not a mirrored pair, has no curved screens, and has no written brief
 * yet — so the suite skips them rather than failing on their absence.
 */

import type { HomeMeta } from '../types'

export const meta: HomeMeta = {
  id: 'ekta',
  name: 'Ekta — 14th floor, Neeldhara',
  subtitle: "Imported from the builder's DWG · 1073 sq ft RERA",
  origin: 'imported',
  checks: {},
}
