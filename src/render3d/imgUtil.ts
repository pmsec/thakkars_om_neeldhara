/**
 * Bound an image before it travels: Vercel functions cap request bodies at
 * ~4.5 MB, and the AI's own full-resolution PNG output blows straight past
 * that when sent back for refinement — Safari then drops the request with a
 * bare "Load failed". Re-encoding to a bounded JPEG keeps every upload well
 * under the limit (and faster on mobile) at no visible quality cost for the
 * model's purposes.
 */
/**
 * The bound is CONFIGURATION, not code: it exists because of the current
 * host's request-body cap (Vercel: ~4.5 MB), not because the app wants small
 * images. On infrastructure without that cap, set VITE_AI_UPLOAD_MAX_PX
 * (e.g. 4096, or 0 to disable shrinking entirely) and rebuild — nothing else
 * changes. Stored images are never degraded; only the upload copy is bounded.
 */
const ENV_MAX = Number(import.meta.env.VITE_AI_UPLOAD_MAX_PX ?? '') || null

export function shrinkDataUrl(dataUrl: string, maxW = 1536, quality = 0.88): Promise<string> {
  const limit = ENV_MAX === null ? maxW : ENV_MAX
  if (limit <= 0) return Promise.resolve(dataUrl)   // explicitly unbounded
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = Math.min(limit, img.width)
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
