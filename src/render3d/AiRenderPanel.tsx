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
  const [result, setResult] = useState<{ out: string; input: string } | null>(null)
  const [overlay, setOverlay] = useState(0)

  const saveKeys = (k: Keys): void => {
    setKeys(k)
    localStorage.setItem(KEYS_LS, JSON.stringify(k))
  }

  const loadModels = useCallback(
    async (p: Provider, k: Keys): Promise<void> => {
      setModels([])
      setModel('')
      if (!k[p]) {
        setModelsMsg('Add the API key below, then load models.')
        return
      }
      setModelsMsg('Loading models…')
      try {
        const r = await fetch(`/api/ai-models?provider=${p}`, {
          headers: { 'x-provider-key': k[p] },
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

  const generate = async (): Promise<void> => {
    const input = capture()
    if (!input) {
      window.alert('The view is not ready to capture yet.')
      return
    }
    if (!keys[provider] || !model) {
      window.alert('Add the API key and pick a model first.')
      return
    }
    setBusy(true)
    try {
      const [head, b64] = input.split(',', 2)
      const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
      const r = await fetch('/api/ai-render', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-provider-key': keys[provider] },
        body: JSON.stringify({ provider, model, prompt, image: b64, mime }),
      })
      const j = (await r.json()) as { image?: string; mime?: string; error?: string }
      if (!r.ok || !j.image) throw new Error(j.error ?? `HTTP ${r.status}`)
      setResult({ out: `data:${j.mime ?? 'image/png'};base64,${j.image}`, input })
      setOverlay(0)
    } catch (err) {
      window.alert(`Generation failed.\n\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
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

          <div style={{ marginTop: 10, borderTop: '1px solid #e2dac8', paddingTop: 8 }}>
            <button onClick={() => setShowKeys(!showKeys)}>
              {showKeys ? 'Hide keys' : 'API keys…'}
            </button>
            {showKeys && (
              <div>
                <p style={{ color: '#6d6558', margin: '6px 0' }}>
                  Stored only in this browser. Sent per-request to the provider via our proxy —
                  never saved on any server.
                </p>
                {(['openai', 'google'] as const).map((p) => (
                  <div style={row} key={p}>
                    <span style={{ width: 62 }}>{p === 'openai' ? 'OpenAI' : 'Google'}</span>
                    <input
                      type="password"
                      value={keys[p]}
                      placeholder={p === 'openai' ? 'sk-…' : 'AIza…'}
                      onChange={(e) => saveKeys({ ...keys, [p]: e.target.value.trim() })}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                ))}
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
              title="Fade the true render over the AI image to check for drift"
            />
            <span>True render</span>
            <a href={result.out} download="ai-render.png">
              <button>Download</button>
            </a>
            <button onClick={() => setResult(null)}>Close</button>
          </div>
          <div style={{ color: '#cfc6b2', fontSize: 12 }}>
            Slide to compare against the true render — never measure from the AI image.
          </div>
        </div>
      )}
    </>
  )
}
