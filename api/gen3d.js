/**
 * POST /api/gen3d — text-to-3D through Meshy or Tripo, normalised to one
 * tiny protocol so the app has a single selector:
 *
 *   { provider: 'meshy'|'tripo', action: 'create', prompt }  -> { taskId }
 *   { provider, action: 'status', taskId }                   -> { status, progress, url }
 *
 * status is 'running' | 'done' | 'failed'; url is the GLB when done.
 * Key: x-provider-key header, else MESHY_API_KEY / TRIPO_API_KEY env vars.
 * (Hunyuan3D has no hosted API — it is open weights to self-host; if that
 * ever changes it slots in here as a third provider.)
 */

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  const { provider, action, prompt, taskId } = req.body || {}
  const key = req.headers['x-provider-key'] ||
    (provider === 'meshy' ? process.env.MESHY_API_KEY : process.env.TRIPO_API_KEY)
  if (!key) {
    res.status(400).json({
      error: `No API key. Add your ${provider} key in the Style panel, or save it server-side as ` +
        (provider === 'meshy' ? 'MESHY_API_KEY' : 'TRIPO_API_KEY') + ' in Vercel env vars.',
    })
    return
  }
  const auth = { authorization: `Bearer ${key}` }

  /** Find the first .glb URL anywhere in a provider response. */
  const findGlb = (o) => {
    if (typeof o === 'string') {
      return o.startsWith('http') && o.split('?')[0].toLowerCase().endsWith('.glb') ? o : null
    }
    if (o && typeof o === 'object') {
      if (typeof o.glb === 'string' && o.glb.startsWith('http')) return o.glb
      for (const v of Object.values(o)) {
        const hit = findGlb(v)
        if (hit) return hit
      }
    }
    return null
  }

  try {
    if (provider === 'meshy') {
      if (action === 'create') {
        const r = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'preview', prompt, art_style: 'realistic', should_remesh: true }),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) { res.status(r.status).json({ error: `Meshy ${r.status}: ${j?.message ?? 'create failed'}` }); return }
        res.status(200).json({ taskId: j.result ?? j.id })
        return
      }
      const r = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${encodeURIComponent(taskId)}`, { headers: auth })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { res.status(r.status).json({ error: `Meshy ${r.status}: ${j?.message ?? 'status failed'}` }); return }
      const st = String(j.status || '').toUpperCase()
      res.status(200).json({
        status: st === 'SUCCEEDED' ? 'done' : st === 'FAILED' || st === 'CANCELED' ? 'failed' : 'running',
        progress: j.progress ?? null,
        url: j?.model_urls?.glb ?? findGlb(j),
        detail: j.task_error?.message ?? null,
      })
      return
    }

    if (provider === 'tripo') {
      if (action === 'create') {
        const r = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'text_to_model', prompt }),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j.code) { res.status(r.ok ? 400 : r.status).json({ error: `Tripo: ${j?.message ?? j?.code ?? 'create failed'}` }); return }
        res.status(200).json({ taskId: j?.data?.task_id })
        return
      }
      const r = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${encodeURIComponent(taskId)}`, { headers: auth })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { res.status(r.status).json({ error: `Tripo ${r.status}: ${j?.message ?? 'status failed'}` }); return }
      const d = j?.data ?? {}
      const st = String(d.status || '').toLowerCase()
      res.status(200).json({
        status: st === 'success' ? 'done' : st === 'failed' || st === 'cancelled' || st === 'banned' ? 'failed' : 'running',
        progress: d.progress ?? null,
        url: d?.output?.pbr_model ?? d?.output?.model ?? findGlb(d),
        detail: null,
      })
      return
    }

    res.status(400).json({ error: 'provider must be meshy or tripo' })
  } catch (err) {
    res.status(502).json({ error: `Could not reach the provider: ${String(err && err.message ? err.message : err)}` })
  }
}
