/**
 * The active home's building data.
 *
 * GENERATED data lives in src/homes/<id>/building.ts; this module only
 * resolves which home the app is currently showing. Every import site in the
 * app points here and never has to know about homes at all.
 *
 * The three constants below describe features not every home has — a mirror
 * line and curved pod screens are facts about Om Neeldhara. A home without
 * them exports MIRROR_X 0 and null pods, and the consumers (the dimension
 * chains, the curved-screen check) skip that work for it.
 */

import { activeHome } from '../homes/active'

export const building = activeHome.building
export const MIRROR_X = activeHome.constants.MIRROR_X
export const POD_PARENTS = activeHome.constants.POD_PARENTS
export const POD_KARAN = activeHome.constants.POD_KARAN
