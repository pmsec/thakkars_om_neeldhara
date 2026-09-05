/**
 * The active home, unpacked. Import sites use src/data/* rather than this
 * directly; this exists so the resolvers stay one line each.
 */

import { activeHome } from './registry'

export const { meta, building, fixtures, furniture, sheetSvg, constants } = activeHome
export { activeHome }
