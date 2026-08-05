/**
 * GET /api/ai-models?provider=openai|google — the provider's model list,
 * filtered to image-generation models only.
 *
 * The API key arrives per-request in the `x-provider-key` header, entered by
 * the user in the app's AI panel and kept in their browser's localStorage.
 * It is never stored server-side; this function only forwards it, because
 * the providers' APIs block browser CORS and the key must not ship in the
 * bundle.
 */

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  const provider = String(req.query.provider || '')
  const key = req.headers['x-provider-key']
  if (!key) {
    res.status(400).json({ error: 'No API key. Add your key in the AI render panel first.' })
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
