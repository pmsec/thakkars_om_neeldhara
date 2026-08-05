/**
 * Bound an image before it travels: Vercel functions cap request bodies at
 * ~4.5 MB, and the AI's own full-resolution PNG output blows straight past
 * that when sent back for refinement — Safari then drops the request with a
 * bare "Load failed". Re-encoding to a bounded JPEG keeps every upload well
 * under the limit (and faster on mobile) at no visible quality cost for the
 * model's purposes.
 */
export function shrinkDataUrl(dataUrl: string, maxW = 1536, quality = 0.88): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = Math.min(maxW, img.width)
      const h = Math.round((img.height / img.width) * w)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')
      if (!g) { resolve(dataUrl); return }
      g.drawImage(img, 0, 0, w, h)
      try {
        resolve(c.toDataURL('image/jpeg', quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
