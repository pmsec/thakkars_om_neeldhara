/**
 * GET /api/plan — the latest CAD sheet, straight from the CAD branch.
 *
 * The repo is private, so the browser cannot fetch GitHub directly; this
 * Vercel function proxies one file using a token that stays server-side.
 *
 * Setup (once, in the Vercel dashboard → Project → Settings → Environment
 * Variables):
 *   GITHUB_TOKEN   a fine-grained PAT with read-only Contents access to the
 *                  repository below. Nothing else.
 * Optional overrides:
 *   PLAN_REPO      owner/repo     (default pmsec/thakkars_om_neeldhara)
 *   PLAN_BRANCH    branch name    (default claude/cad-apartment-merge-miwnpm)
 *   PLAN_PATH      file path      (default CAD/drawings/07-round1-layout.svg)
 */

const REPO = process.env.PLAN_REPO || 'pmsec/thakkars_om_neeldhara'
const BRANCH = process.env.PLAN_BRANCH || 'claude/cad-apartment-merge-miwnpm'
const PATH = process.env.PLAN_PATH || 'CAD/drawings/07-round1-layout.svg'

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    res.status(500).json({
      error:
        'GITHUB_TOKEN is not configured. Add a fine-grained GitHub token with ' +
        `read-only Contents access to ${REPO} in the Vercel project's environment variables.`,
    })
    return
  }
  const gh = {
    authorization: `Bearer ${token}`,
    'user-agent': 'om-neeldhara-portal',
    'x-github-api-version': '2022-11-28',
  }
  try {
    const [fileRes, commitRes] = await Promise.all([
      fetch(
        `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(PATH)}?ref=${encodeURIComponent(BRANCH)}`,
        { headers: { ...gh, accept: 'application/vnd.github.raw+json' } },
      ),
      fetch(
        `https://api.github.com/repos/${REPO}/commits?sha=${encodeURIComponent(BRANCH)}&path=${encodeURIComponent(PATH)}&per_page=1`,
        { headers: { ...gh, accept: 'application/vnd.github+json' } },
      ),
    ])
    if (!fileRes.ok) {
      res.status(fileRes.status).json({
        error: `GitHub returned ${fileRes.status} for the sheet — check the token's access to ${REPO}.`,
      })
      return
    }
    const svg = await fileRes.text()
    let commit = null
    if (commitRes.ok) {
      const commits = await commitRes.json()
      if (Array.isArray(commits) && commits[0]) {
        commit = {
          sha: commits[0].sha?.slice(0, 10) ?? '',
          date: commits[0].commit?.committer?.date ?? '',
          message: (commits[0].commit?.message ?? '').split('\n')[0],
        }
      }
    }
    res.status(200).json({ svg, commit, branch: BRANCH, path: PATH })
  } catch (err) {
    res.status(502).json({ error: `Could not reach GitHub: ${String(err && err.message ? err.message : err)}` })
  }
}
