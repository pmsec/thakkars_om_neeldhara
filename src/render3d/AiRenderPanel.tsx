/**
 * The AI render panel: photoreal re-render of the current view through
 * OpenAI or Google image models, selected live from each provider's own
 * model list (filtered to image models).
 *
 * Keys are entered here, kept in THIS BROWSER's localStorage only, and sent
 * per-request to our proxy functions — the providers block CORS, so the
 * calls must hop through /api, but nothing is stored server-side.
 *
 * The input image is our own render (true geometry), so the model's job is
 * materials and light. The result opens with a compare slider that fades
 * the original over the AI image — the drift check that decides whether an
 * output is trustworthy enough to share.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { deleteRender, listRenders, saveRender, type SavedRender } from './aiStore'

export const DEFAULT_PROMPT =
  'Re-render this architectural floor-plan view photorealistically. Keep every wall, ' +
  'opening and piece of furniture in exactly its current position and size — change ' +
  'nothing structural. Upgrade the materials: dark walnut plank flooring, honed stone, ' +
  'real grass, linen upholstery, brass accents. Soft warm evening light, gentle ' +
  'shadows, high-end architectural photography quality, top-down view.'

type Provider = 'openai' | 'google'

interface Keys {
  openai: string
  google: string
}

const KEYS_LS = 'om-ai-keys'

function loadKeys(): Keys {
  try {
    return { openai: '', google: '', ...JSON.parse(localStorage.getItem(KEYS_LS) || '{}') }
  } catch {
    return { openai: '', google: '' }
  }
}

export function AiRenderPanel({
  capture,
}: {
  /** Returns the current view as a JPEG data URL, or null if not ready. */
  capture: () => string | null
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [keys, setKeys] = useState<Keys>(loadKeys)
  const [showKeys, setShowKeys] = useState(false)
  const [provider, setProvider] = useState<Provider>('openai')
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [modelsMsg, setModelsMsg] = useState('')
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ out: string; input: string; prompt: string } | null>(null)
  const [overlay, setOverlay] = useState(0)
  const [note, setNote] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [gallery, setGallery] = useState<SavedRender[] | null>(null)

  const saveKeys = (k: Keys): void => {
    setKeys(k)
    localStorage.setItem(KEYS_LS, JSON.stringify(k))
  }

  const loadModels = useCallback(
    async (p: Provider, k: Keys): Promise<void> => {
      setModels([])
      setModel('')
      setModelsMsg('Loading models…')
      try {
        // a key typed here wins; with none, the server falls back to the
        // keys saved in Vercel env vars — set once, never re-entered
        const r = await fetch(`/api/ai-models?provider=${p}`, {
          headers: k[p] ? { 'x-provider-key': k[p] } : {},
        })
        const j = (await r.json()) as { models?: string[]; error?: string }
        if (!r.ok || !j.models) throw new Error(j.error ?? `HTTP ${r.status}`)
        setModels(j.models)
        // sensible default: the newest image model the provider offers
        const preferred =
          j.models.find((m) => /gpt-image-2|flash-image/i.test(m)) ?? j.models[0] ?? ''
        setModel(preferred)
        setModelsMsg(j.models.length ? '' : 'No image models visible to this key.')
      } catch (err) {
        setModelsMsg(String(err instanceof Error ? err.message : err))
      }
    },
    [],
  )

  useEffect(() => {
    if (open) void loadModels(provider, keys)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider])

  /** One provider round trip: data-URL in, data-URL out. */
  const requestRender = async (input: string, thePrompt: string): Promise<string> => {
    const [head, b64] = input.split(',', 2)
    const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
    const r = await fetch('/api/ai-render', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(keys[provider] ? { 'x-provider-key': keys[provider] } : {}),
      },
      body: JSON.stringify({ provider, model, prompt: thePrompt, image: b64, mime }),
    })
    const j = (await r.json()) as { image?: string; mime?: string; error?: string }
    if (!r.ok || !j.image) throw new Error(j.error ?? `HTTP ${r.status}`)
    return `data:${j.mime ?? 'image/png'};base64,${j.image}`
  }

  const generate = async (): Promise<void> => {
    const input = capture()
    if (!input) {
      window.alert('The view is not ready to capture yet.')
      return
    }
    if (!model) {
      window.alert('Pick a model first (load the list with ↻).')
      return
    }
    setBusy(true)
    try {
      const out = await requestRender(input, prompt)
      setResult({ out, input, prompt })
      setOverlay(0)
      setNote('')
      setSaveMsg('')
      setEditPrompt('')
    } catch (err) {
      window.alert(`Generation failed.\n\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  /** Send the GENERATED image back with an edit prompt — iterate to taste.
   * The compare slider then compares against the version being edited. */
  const refine = async (): Promise<void> => {
    if (!result || !editPrompt.trim()) return
    setBusy(true)
    try {
      const out = await requestRender(result.out, editPrompt.trim())
      setResult({ out, input: result.out, prompt: editPrompt.trim() })
      setOverlay(0)
      setSaveMsg('')
      setEditPrompt('')
    } catch (err) {
      window.alert(`Edit failed.\n\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const saveCurrent = async (): Promise<void> => {
    if (!result) return
    try {
      await saveRender({
        at: Date.now(), note: note.trim(), provider, model,
        prompt: result.prompt, out: result.out, input: result.input,
      })
      setSaveMsg('Saved ✓')
    } catch (err) {
      setSaveMsg(`Could not save: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const openGallery = async (): Promise<void> => {
    try {
      setGallery(await listRenders())
    } catch (err) {
      window.alert(`Could not open saved renders.\n\n${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const [extractMsg, setExtractMsg] = useState('')
  /** Read the material palette out of THIS render: a vision model lists every
   * distinct material as a single-material tile prompt, and the Style panel
   * picks them up as a ready palette. */
  const extractMaterials = async (): Promise<void> => {
    if (!result) return
    setExtractMsg('Reading materials…')
    try {
      const [head, b64] = result.out.split(',', 2)
      const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png'
      const r = await fetch('/api/ai-describe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(keys[provider] ? { 'x-provider-key': keys[provider] } : {}),
        },
        body: JSON.stringify({ provider, image: b64, mime }),
      })
      const j = (await r.json()) as { materials?: Array<{ surface: string; prompt: string }>; error?: string }
      if (!r.ok || !j.materials) throw new Error(j.error ?? `HTTP ${r.status}`)
      // Keep a downscaled copy of the RENDER with the palette: tiles are then
      // extracted image-to-image from the actual pixels, not re-imagined from
      // the text — the saved material is the material you approved.
      const ref = await new Promise<string>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const w = Math.min(768, img.width)
          const c = document.createElement('canvas')
          c.width = w
          c.height = Math.round((img.height / img.width) * w)
          const g = c.getContext('2d')
          if (!g) { resolve(result.out); return }
          g.drawImage(img, 0, 0, c.width, c.height)
          resolve(c.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => resolve(result.out)
        img.src = result.out
      })
      localStorage.setItem('om-material-palette', JSON.stringify({ at: Date.now(), materials: j.materials, ref }))
      window.dispatchEvent(new Event('om-palette-changed'))
      setExtractMsg(`Palette of ${j.materials.length} materials ready — open 🎨 Style → Materials.`)
    } catch (err) {
      setExtractMsg(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const card: React.CSSProperties = {
    position: 'absolute', top: 10, right: 10, width: 330, maxHeight: 'calc(100% - 20px)',
    overflowY: 'auto', background: 'rgba(250,248,244,0.97)', border: '1px solid #d5cdbb',
    borderRadius: 8, padding: 12, boxShadow: '0 4px 16px rgba(40,34,24,0.18)', fontSize: 13,
  }
  const row: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', margin: '6px 0' }

  return (
    <>
      {!open && (
        <button
          style={{ position: 'absolute', top: 10, right: 10 }}
          onClick={() => setOpen(true)}
          title="Photoreal re-render of this view through OpenAI or Google image models"
        >
          ✨ AI render
        </button>
      )}
      {open && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>AI render</b>
            <button onClick={() => setOpen(false)}>×</button>
          </div>
          <p style={{ margin: '6px 0', color: '#6d6558' }}>
            Input is this exact view — the AI only repaints materials and light. Judge every
            result with the compare slider before trusting it.
          </p>

          <div style={row}>
            <span style={{ width: 62 }}>Provider</span>
            {(['openai', 'google'] as const).map((p) => (
              <button key={p} aria-pressed={provider === p} onClick={() => setProvider(p)}>
                {p === 'openai' ? 'OpenAI' : 'Google'}
              </button>
            ))}
          </div>

          <div style={row}>
            <span style={{ width: 62 }}>Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
              disabled={!models.length}
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button onClick={() => void loadModels(provider, keys)} title="Reload the model list">
              ↻
            </button>
          </div>
          {modelsMsg && <div style={{ color: '#8a5a2f', margin: '2px 0 6px' }}>{modelsMsg}</div>}

          <div style={{ margin: '6px 0' }}>
            <div style={{ marginBottom: 3 }}>Prompt</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }}
            />
          </div>

          <button style={{ width: '100%', padding: '7px 0' }} disabled={busy} onClick={() => void generate()}>
            {busy ? 'Generating… (10–30 s)' : 'Generate'}
          </button>
          <button style={{ width: '100%', marginTop: 6 }} onClick={() => void openGallery()}>
            Saved renders…
          </button>

          <div style={{ marginTop: 10, borderTop: '1px solid #e2dac8', paddingTop: 8 }}>
            <button onClick={() => setShowKeys(!showKeys)}>
              {showKeys ? 'Hide keys' : 'API keys…'}
            </button>
            {showKeys && (
              <div>
                <p style={{ color: '#6d6558', margin: '6px 0' }}>
                  Optional. A key typed here stays in this browser and wins; leave empty to
                  use the keys saved server-side (OPENAI_API_KEY / GOOGLE_API_KEY in Vercel).
                </p>
                {(['openai', 'google'] as const).map((p) => (
                  <div style={row} key={p}>
                    <span style={{ width: 62 }}>{p === 'openai' ? 'OpenAI' : 'Google'}</span>
                    <input
                      type="password"
                      value={keys[p]}
                      placeholder="empty = use the server key"
                      onChange={(e) => saveKeys({ ...keys, [p]: e.target.value.trim() })}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    {keys[p] && (
                      <button
                        title="Forget this browser key and use the server key instead"
                        onClick={() => {
                          saveKeys({ ...keys, [p]: '' })
                          void loadModels(provider, { ...keys, [p]: '' })
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {(keys.openai || keys.google) && (
                  <p style={{ color: '#8a5a2f', margin: '4px 0', fontSize: 12 }}>
                    A key typed here OVERRIDES the server key — if it is old or disabled you
                    will see 401. Press ✕ to fall back to the key saved in Vercel.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {result && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(30,28,24,0.88)', zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 18, gap: 10,
          }}
        >
          <div style={{ position: 'relative', flex: 1, minHeight: 0, maxWidth: '96%' }}>
            <img src={result.out} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
            <img
              src={result.input}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'contain', opacity: overlay, pointerEvents: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#f3ecdd', fontSize: 13 }}>
            <span>AI</span>
            <input
              type="range" min={0} max={1} step={0.01} value={overlay}
              onChange={(e) => setOverlay(Number(e.target.value))}
              style={{ width: 220 }}
              title="Fade the source image over the AI image to check for drift"
            />
            <span>Source</span>
            <a href={result.out} download="ai-render.png">
              <button>Download</button>
            </a>
            <button onClick={() => setResult(null)}>Close</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: 'min(760px, 96%)' }}>
            <input
              value={note}
              onChange={(e) => { setNote(e.target.value); setSaveMsg('') }}
              placeholder="Note for this render (e.g. “warm evening, best floor so far”)"
              style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '5px 8px' }}
            />
            <button disabled={busy} onClick={() => void saveCurrent()}>Save</button>
            {saveMsg && <span style={{ color: '#bfd8b0', fontSize: 12, whiteSpace: 'nowrap' }}>{saveMsg}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: 'min(760px, 96%)' }}>
            <input
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void refine() }}
              placeholder="Edit this image: describe one change (e.g. “make the rug deep blue”)"
              style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '5px 8px' }}
            />
            <button disabled={busy || !editPrompt.trim()} onClick={() => void refine()}>
              {busy ? 'Working…' : 'Refine'}
            </button>
            <button
              disabled={busy}
              title="List every material in this render as single-material tile prompts, ready in the Style panel"
              onClick={() => void extractMaterials()}
            >
              Extract materials
            </button>
          </div>
          {extractMsg && (
            <div style={{ color: extractMsg.startsWith('Failed') ? '#e8a5a5' : '#bfd8b0', fontSize: 12 }}>
              {extractMsg}
            </div>
          )}
          <div style={{ color: '#cfc6b2', fontSize: 12 }}>
            Slide to compare against the source — never measure from the AI image. Refine sends
            THIS image back to the model with your edit; the slider then compares to the version you edited.
          </div>
        </div>
      )}

      {gallery && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(30,28,24,0.92)', zIndex: 30,
            display: 'flex', flexDirection: 'column', padding: 18, gap: 10, overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#f3ecdd' }}>
            <b>Saved renders ({gallery.length})</b>
            <button onClick={() => setGallery(null)}>Close</button>
          </div>
          {gallery.length === 0 && (
            <div style={{ color: '#cfc6b2' }}>
              Nothing saved yet — generate a render, add a note and press Save.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {gallery.map((r) => (
              <div key={r.id} style={{ background: 'rgba(250,248,244,0.96)', borderRadius: 8, padding: 8, fontSize: 12 }}>
                <img
                  src={r.out}
                  style={{ width: '100%', borderRadius: 4, cursor: 'pointer', display: 'block' }}
                  title="Open with the compare slider"
                  onClick={() => {
                    setResult({ out: r.out, input: r.input, prompt: r.prompt })
                    setOverlay(0)
                    setNote(r.note)
                    setSaveMsg('')
                    setEditPrompt('')
                    setGallery(null)
                  }}
                />
                <div style={{ margin: '6px 0 2px', fontWeight: 600 }}>{r.note || '(no note)'}</div>
                <div style={{ color: '#6d6558' }}>
                  {new Date(r.at).toLocaleString()} · {r.provider} · {r.model}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <a href={r.out} download={`ai-render-${r.id}.png`}><button>Download</button></a>
                  <button
                    onClick={() => {
                      void deleteRender(r.id).then(openGallery)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
