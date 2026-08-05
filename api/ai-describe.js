/**
 * POST /api/ai-describe — look at a render and extract its MATERIAL PALETTE:
 * every distinct visible material as a single-material texture prompt, ready
 * to feed the tile generator one by one.
 *
 * Body: { provider: 'openai'|'google', model?, image (base64), mime }
 * Key:  x-provider-key header, else OPENAI_API_KEY / GOOGLE_API_KEY env.
 * Returns { materials: [{ surface, prompt }] } or { error }.
 */

export const config = { maxDuration: 30 }

const ASK =
  'You are looking at an interior architecture render. Return STRICT JSON only, of ' +
  'the shape {"materials":[{"surface":"floor","prompt":"..."}],"lighting":{"name":' +
  '"...","warmth":0.5,"brightness":0.5,"sunDir":"W","sunHeight":"low"}}. ' +
  'materials: every DISTINCT visible material (flooring, wall finish, stone, ' +
  'upholstery fabric, wood, metal, glass tint, rug, greenery). Each prompt describes ' +
  'exactly ONE material as a brief for a seamless texture tile generator: material ' +
  'name, colour, grain or pattern, finish. 4 to 8 entries, no duplicates. ' +
  'lighting: the scene mood — name (2-3 words), warmth 0 (cool daylight) to 1 (deep ' +
  'amber), brightness 0 (dusk-dark) to 1 (full day), sunDir the compass the light ' +
  'comes from (N NE E SE S SW W NW), sunHeight low|mid|high. No commentary outside the JSON.'

function parseResult(text) {
  try {
    const j = JSON.parse(String(text).replace(/^```(json)?|```$/gm, '').trim())
    const list = Array.isArray(j) ? j : j.materials
    if (!Array.isArray(list)) return null
    const materials = list
      .map((m) => ({ surface: String(m.surface ?? m.name ?? 'material'), prompt: String(m.prompt ?? '') }))
      .filter((m) => m.prompt.length > 3)
      .slice(0, 10)
    if (!materials.length) return null
    let lighting = null
    const L = j.lighting
    if (L && typeof L === 'object') {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
      const heights = ['low', 'mid', 'high']
      lighting = {
        name: String(L.name ?? 'From render').slice(0, 40),
        warmth: Math.min(1, Math.max(0, Number(L.warmth) || 0.5)),
        brightness: Math.min(1, Math.max(0, Number(L.brightness) || 0.5)),
        sunDir: dirs.includes(String(L.sunDir).toUpperCase()) ? String(L.sunDir).toUpperCase() : 'SE',
        sunHeight: heights.includes(String(L.sunHeight)) ? String(L.sunHeight) : 'mid',
      }
    }
    return { materials, lighting }
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  const { provider, model, image, mime } = req.body || {}
  if (!provider || !image) {
    res.status(400).json({ error: 'provider and image are required.' })
    return
  }
  const key = String(req.headers['x-provider-key'] ||
    (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GOOGLE_API_KEY) || '').trim()
  if (!key) {
    res.status(400).json({ error: 'No API key for ' + provider + '.' })
    return
  }

  try {
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: model || process.env.AI_DESCRIBE_MODEL_OPENAI || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: ASK },
              { type: 'image_url', image_url: { url: `data:${mime || 'image/png'};base64,${image}` } },
            ],
          }],
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        res.status(r.status).json({ error: `OpenAI ${r.status}: ${j?.error?.message ?? 'analysis failed'}` })
        return
      }
      const parsed = parseResult(j?.choices?.[0]?.message?.content)
      if (!parsed) {
        res.status(502).json({ error: 'OpenAI returned no parsable material list.' })
        return
      }
      res.status(200).json(parsed)
      return
    }

    if (provider === 'google') {
      const gModel = model || process.env.AI_DESCRIBE_MODEL_GOOGLE || 'gemini-2.5-flash'
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gModel)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: ASK },
                { inline_data: { mime_type: mime || 'image/png', data: image } },
              ],
            }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
      )
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        res.status(r.status).json({ error: `Google ${r.status}: ${j?.error?.message ?? 'analysis failed'}` })
        return
      }
      const text = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.text)?.text
      const parsed = parseResult(text)
      if (!parsed) {
        res.status(502).json({ error: 'Google returned no parsable material list.' })
        return
      }
      res.status(200).json(parsed)
      return
    }

    res.status(400).json({ error: 'provider must be openai or google' })
  } catch (err) {
    res.status(502).json({ error: `Could not reach the provider: ${String(err && err.message ? err.message : err)}` })
  }
}
