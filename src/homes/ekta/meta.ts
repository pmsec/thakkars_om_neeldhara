/**
 * Ekta's flat — 14th floor, Neeldhara, next door to Om Neeldhara.
 *
 * `origin: 'authored'` NOW. It began as `imported` and the word was accurate:
 * geometry read out of the builder's DWG, correct but mute. It is not that any
 * more — the flat has been designed on top of that import, and what the app
 * reads is the design: eight rooms instead of his thirteen, walls that are
 * ours, and furniture in every one of them. The record of what he drew is
 * frozen in the CAD repo as homes/ekta/design.imported.py.
 *
 * `checks` stays empty on purpose. Those are assertions about a PARTICULAR
 * home — Om Neeldhara is two wings mirrored about x 12240 with curved pod
 * screens of a known span — and none of them is true here. A home without
 * those properties omits them and the suite skips them rather than failing on
 * their absence. The universal geometry checks apply to every home and are not
 * opted into.
 */

import type { HomeMeta } from '../types'

export const meta: HomeMeta = {
  id: 'ekta',
  name: 'Ekta — 14th floor, Neeldhara',
  subtitle: 'Designed on the builder’s DWG · 1073 sq ft RERA · 8 rooms',
  origin: 'authored',
  checks: {},
}
