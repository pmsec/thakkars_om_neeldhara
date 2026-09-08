import { chromium, devices } from 'playwright'
const OUT = '/tmp/claude-0/-home-user-thakkars-om-neeldhara/4e8dde07-f9e2-5065-b7c3-740ca7938d67/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, hasTouch: true, isMobile: false })
const p = await ctx.newPage()
p.setDefaultTimeout(180000)
const errs = []
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
await p.goto('http://localhost:4319/', { waitUntil: 'networkidle' })
await p.evaluate(() => { localStorage.setItem('om-active-home', 'om-neeldhara'); localStorage.removeItem('om-ui') })
await p.goto('http://localhost:4319/#cam=12240,1620,4300,12240,1400,1160', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Walkthrough', exact: true }).click({ force: true })
await p.waitForTimeout(6000)
await p.getByRole('button', { name: 'Walk', exact: true }).click({ force: true })
await p.waitForTimeout(3000)
await p.screenshot({ path: `${OUT}/rails-1.png`, timeout: 180000 })
// drag the EYE rail up: it sits above the TILT rail on the right edge
const eye = await p.evaluate(() => {
  const els = [...document.querySelectorAll('div')].filter((d) => d.textContent === 'EYE')
  const r = els[0].parentElement.getBoundingClientRect()
  return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }
})
const cdp = await ctx.newCDPSession(p)
const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
await touch('touchStart', eye.x, eye.bottom - 20)
for (let i = 1; i <= 8; i++) { await touch('touchMove', eye.x, eye.bottom - 20 - (eye.bottom - eye.top - 30) * i / 8 * 0.85); await p.waitForTimeout(80) }
await touch('touchEnd', 0, 0)
await p.waitForTimeout(3000)
await p.screenshot({ path: `${OUT}/rails-2-high.png`, timeout: 180000 })
console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no page errors')
await b.close()
