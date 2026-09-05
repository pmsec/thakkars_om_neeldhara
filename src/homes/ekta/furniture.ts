/**
 * Ekta — 14th floor, Neeldhara — GENERATED. No furniture yet.
 */

export type FurnitureKind =
  | 'sofa' | 'bed' | 'daybed' | 'armchair' | 'table' | 'console'
  | 'bench' | 'stool' | 'lounger' | 'rug' | 'plant' | 'tree'
  | 'shelves' | 'dining' | 'chair' | 'drumkit' | 'guitar' | 'stair'
  | 'wardrobe' | 'planter' | 'grass' | 'screen' | 'tv'

export interface FurnitureItem {
  id: string
  kind: FurnitureKind
  x: number
  y: number
  w: number
  d: number
  face?: 'N' | 'S' | 'E' | 'W'
  room: string
  label: string
  height: number
  seats?: [number, number]
  poly?: { x: number; y: number }[]
}

export const furniture: FurnitureItem[] = []
