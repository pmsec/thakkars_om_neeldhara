/**
 * The 2D plan as an AI REFERENCE IMAGE: the CAD sheet with its label,
 * dimension and title layers hidden — pure geometry, high contrast, nothing
 * for an image model to smear into the output as garbage text. Sent as a
 * second input alongside the view being rendered, so the model holds the
 * source of truth in view while it repaints.
 */

import { sheetSvg as sheetSvgRaw } from '../data/sheet'

const HIDE_LAYERS = ['L-labels', 'L-dims', 'L-title', 'L-keepclear', 'L-ref']

let cached: string | null = null

export function planRefDataUrl(maxW = 1024): Promise<string | null> {
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve) => {
    try {
      const doc = new DOMParser().parseFromString(sheetSvgRaw, 'image/svg+xml')
      for (const id of HIDE_LAYERS) {
        const g = doc.getElementById(id)
        if (g) g.setAttribute('display', 'none')
      }
      const svg = new XMLSerializer().serializeToString(doc.documentElement)
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        const w = Math.min(maxW, img.width || maxW)
        const h = Math.round(((img.height || 1) / (img.width || 1)) * w)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')
        if (!g) { resolve(null); return }
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, w, h)
        g.drawImage(img, 0, 0, w, h)
        cached = c.toDataURL('image/jpeg', 0.85)
        resolve(cached)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    } catch {
      resolve(null)
    }
  })
}
