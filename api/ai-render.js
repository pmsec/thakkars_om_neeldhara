/**
 * POST /api/ai-render — photoreal re-render of a view through the chosen
 * provider's image model. The INPUT image is our own render, generated from
 * the true model geometry, so the AI's job is materials and light only.
 *
 * Body (JSON): { provider, model, prompt, image (base64, no data: prefix),
 *                mime }
 * Header:      x-provider-key — a key typed in the app's AI panel. When
 *              absent, the keys saved server-side in Vercel env vars
 *              (OPENAI_API_KEY / GOOGLE_API_KEY) are used instead — set
 *              once, never re-entered. A typed key always wins.
 *
 * Returns { image (base64 PNG), mime } or { error }.
 */

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  const { provider, model, prompt, image, mime } = req.body || {}
  if (!provider || !model || !prompt || !image) {
    res.status(400).json({ error: 'provider, model, prompt and image are all required.' })
    return
  }
  const key = req.headers['x-provider-key'] ||
    (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GOOGLE_API_KEY)
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
      const form = new FormData()
      form.append('model', model)
      form.append('prompt', prompt)
      form.append('n', '1')
      form.append('size', '1536x1024')
      form.append(
        'image',
        new Blob([Buffer.from(image, 'base64')], { type: mime || 'image/jpeg' }),
        'view.jpg',
      )
      const r = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}` },
        body: form,
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        res.status(r.status).json({
          error: `OpenAI ${r.status}: ${j?.error?.message ?? 'generation failed'}`,
        })
        return
      }
      const b64 = j?.data?.[0]?.b64_json
      if (!b64) {
        res.status(502).json({ error: 'OpenAI returned no image.' })
        return
      }
      res.status(200).json({ image: b64, mime: 'image/png' })
      return
    }

    if (provider === 'google') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mime || 'image/jpeg', data: image } },
                ],
              },
            ],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        },
      )
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        res.status(r.status).json({
          error: `Google ${r.status}: ${j?.error?.message ?? 'generation failed'}`,
        })
        return
      }
      const parts = j?.candidates?.[0]?.content?.parts || []
      const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data)
      const data = img?.inlineData?.data ?? img?.inline_data?.data
      if (!data) {
        const text = parts.find((p) => p.text)?.text
        res.status(502).json({
          error: `Google returned no image${text ? ` — it said: ${String(text).slice(0, 220)}` : '.'}`,
        })
        return
      }
      res.status(200).json({
        image: data,
        mime: img?.inlineData?.mimeType ?? img?.inline_data?.mime_type ?? 'image/png',
      })
      return
    }

    res.status(400).json({ error: 'provider must be openai or google' })
  } catch (err) {
    res.status(502).json({ error: `Could not reach the provider: ${String(err && err.message ? err.message : err)}` })
  }
}
