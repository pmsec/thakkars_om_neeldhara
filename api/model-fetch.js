/**
 * GET /api/model-fetch?url=… — fetch a GLB server-side so the browser can
 * store it (provider CDNs and model sites rarely send CORS headers). Host
 * allowlist keeps this from being an open proxy.
 */

export const config = { maxDuration: 30 }

const ALLOWED = ['.meshy.ai', '.tripo3d.ai', '.tripo3d.com', '.polyhaven.org',
  '.polyhaven.com', '.poly.pizza', '.githubusercontent.com', '.sketchfab.com']

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  const url = String(req.query.url || '')
  let host
  try {
    host = new URL(url).hostname
  } catch {
    res.status(400).json({ error: 'Pass a full URL in ?url=' })
    return
  }
  if (!ALLOWED.some((s) => host === s.slice(1) || host.endsWith(s))) {
    res.status(400).json({ error: `Host ${host} is not on the model-source allowlist.` })
    return
  }
  try {
    const r = await fetch(url, { redirect: 'follow' })
    if (!r.ok) {
      res.status(r.status).json({ error: `Source replied ${r.status}` })
      return
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > 20 * 1024 * 1024) {
      res.status(413).json({ error: `Model is ${(buf.length / 1e6).toFixed(1)} MB — too large to proxy. Pick a lower-resolution export.` })
      return
    }
    res.setHeader('content-type', 'model/gltf-binary')
    res.status(200).send(buf)
  } catch (err) {
    res.status(502).json({ error: `Could not fetch: ${String(err && err.message ? err.message : err)}` })
  }
}
