/**
 * THE HOME REGISTRY.
 *
 * Every home the app knows about, and which one is active. Adding a home is
 * adding one entry here plus its generated data directory — nothing else in
 * the app changes, because everything downstream reads the ACTIVE home
 * through src/data/*, which resolves against this file.
 *
 * The active home is chosen once at page load and switching reloads the
 * page. That is deliberate: the 3D scenes, derived model and material
 * libraries are all built at module init, and a reload is both simpler and
 * more certain than tearing every one of them down live.
 *
 * ISOLATION: a home's browser state — style assignments, material and object
 * libraries, saved renders — is namespaced by home id (see storageKey), so
 * dressing one home can never touch another's. API keys stay shared: they
 * belong to you, not to a building.
 */

import type { Home } from './types'

import { meta as omNeeldharaMeta } from './om-neeldhara/meta'
import {
  building as omNeeldharaBuilding,
  MIRROR_X as omNeeldharaMirror,
  POD_PARENTS as omNeeldharaPodP,
  POD_KARAN as omNeeldharaPodK,
} from './om-neeldhara/building'
import { fixtures as omNeeldharaFixtures } from './om-neeldhara/fixtures'
import { furniture as omNeeldharaFurniture } from './om-neeldhara/furniture'
import omNeeldharaSheet from './om-neeldhara/plan-sheet.svg?raw'

const omNeeldhara: Home = {
  meta: omNeeldharaMeta,
  building: omNeeldharaBuilding,
  fixtures: omNeeldharaFixtures,
  furniture: omNeeldharaFurniture,
  sheetSvg: omNeeldharaSheet,
  constants: {
    MIRROR_X: omNeeldharaMirror,
    POD_PARENTS: omNeeldharaPodP,
    POD_KARAN: omNeeldharaPodK,
  },
}

/** Every home, in the order they appear on the home page. */
export const HOMES: Home[] = [omNeeldhara]

/** The home the app falls back to, always. */
export const DEFAULT_HOME_ID = 'om-neeldhara'

const ACTIVE_LS = 'om-active-home'

function readActiveId(): string {
  try {
    const id = localStorage.getItem(ACTIVE_LS)
    if (id && HOMES.some((h) => h.meta.id === id)) return id
  } catch {
    /* private mode, blocked storage — fall through to the default */
  }
  return DEFAULT_HOME_ID
}

/** Resolved ONCE at module init: the whole app agrees on one home per load. */
export const activeHome: Home =
  HOMES.find((h) => h.meta.id === readActiveId()) ?? omNeeldhara

export const activeHomeId = activeHome.meta.id

/** Switch home and reload, so every scene rebuilds cleanly against it. */
export function setActiveHome(id: string): void {
  if (!HOMES.some((h) => h.meta.id === id)) return
  try {
    localStorage.setItem(ACTIVE_LS, id)
  } catch {
    /* nothing we can do; the app stays on the current home */
  }
  window.location.reload()
}

/**
 * A per-home storage key. Everything a home accumulates in the browser goes
 * through this, so two homes can never read or overwrite each other's state.
 * Home 1 keeps its ORIGINAL un-suffixed keys, so nothing you have already
 * saved is orphaned by this change.
 */
export function storageKey(base: string): string {
  return activeHomeId === DEFAULT_HOME_ID ? base : `${base}:${activeHomeId}`
}
