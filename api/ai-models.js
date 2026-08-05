/**
 * GET /api/ai-models?provider=openai|google — the provider's model list,
 * filtered to image-generation models only.
 *
 * The API key comes from the `x-provider-key` header (typed in the app,
 * kept in that browser's localStorage) or, when the header is absent, from
 * the keys saved server-side in Vercel env vars (OPENAI_API_KEY /
 * GOOGLE_API_KEY) — set once, never re-entered. A typed key always wins.
 */

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  const provider = String(req.query.provider || '')
  const key = String(req.headers['x-provider-key'] ||
    (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GOOGLE_API_KEY) || '').trim()
  if (!key) {
    res.status(400).json({
      error: 'No API key. Add yours in the AI render panel, or save one server-side as ' +
        (provider === 'openai' ? 'OPENAI_API_KEY' : 'GOOGLE_API_KEY') +
        ' in Vercel → Settings → Environment Variables.',
    })
    return
  }
  try {
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { authorization: `Bearer ${key}` },
      })
      if (!r.ok) {
        res.status(r.status).json({ error: `OpenAI replied ${r.status} — check the key.` })
        return
      }
      const j = await r.json()
      const models = (j.data || [])
        .map((m) => m.id)
        .filter((id) => /gpt-image|dall-e/i.test(id))
        .sort()
        .reverse()                       // newest naming first
      res.status(200).json({ models })
      return
    }
    if (provider === 'google') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`,
      )
      if (!r.ok) {
        res.status(r.status).json({ error: `Google replied ${r.status} — check the key.` })
        return
      }
      const j = await r.json()
      const models = (j.models || [])
        .filter(
          (m) =>
            /image/i.test(m.name) &&
            (m.supportedGenerationMethods || []).includes('generateContent'),
        )
        .map((m) => m.name.replace(/^models\//, ''))
        .sort()
        .reverse()
      res.status(200).json({ models })
      return
    }
    res.status(400).json({ error: 'provider must be openai or google' })
  } catch (err) {
    res.status(502).json({ error: `Could not reach the provider: ${String(err && err.message ? err.message : err)}` })
  }
}
