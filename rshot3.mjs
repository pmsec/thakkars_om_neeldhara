import { chromium } from 'playwright'
const OUT = '/tmp/claude-0/-home-user-thakkars-om-neeldhara/4e8dde07-f9e2-5065-b7c3-740ca7938d67/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, hasTouch: true, isMobile: false })
const p = await ctx.newPage()
p.setDefaultTimeout(240000)
await p.goto('http://localhost:4319/#cam=12240,1620,4300,12240,1400,1160', { waitUntil: 'networkidle' })
await p.evaluate(() => { localStorage.setItem('om-active-home', 'om-neeldhara'); localStorage.removeItem('om-ui') })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(2000)
await p.getByRole('button', { name: 'Walkthrough', exact: true }).click({ force: true })
await p.waitForTimeout(5000)
await p.getByRole('button', { name: 'Walk', exact: true }).click({ force: true })
await p.waitForTimeout(1500)
const rails = { eye: { x: 1469, top: 522, bottom: 692 }, tilt: { x: 1469, top: 726, bottom: 896 } }
const cdp = await ctx.newCDPSession(p)
const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
const drag = async (r, fromT, toT) => {
  const y = (t) => r.bottom - 17 - (r.bottom - r.top - 34) * t
  await touch('touchStart', r.x, y(fromT))
  for (let i = 1; i <= 6; i++) { await touch('touchMove', r.x, y(fromT + (toT - fromT) * i / 6)); await p.waitForTimeout(40) }
  await touch('touchEnd', 0, 0)
}
await drag(rails.eye, 0.22, 0.75)
await drag(rails.tilt, 0.5, 0.28)
await p.waitForTimeout(2500)
await p.screenshot({ path: `${OUT}/rails-3-high-down.png`, timeout: 240000 })
console.log('ok')
await b.close()
