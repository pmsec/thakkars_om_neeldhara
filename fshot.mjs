import { chromium } from 'playwright'
const OUT = '/tmp/claude-0/-home-user-thakkars-om-neeldhara/4e8dde07-f9e2-5065-b7c3-740ca7938d67/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
p.setDefaultTimeout(180000)
const errs = []
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
await p.goto('http://localhost:4319/', { waitUntil: 'networkidle' })
await p.evaluate(() => { localStorage.setItem('om-active-home', 'om-neeldhara'); localStorage.removeItem('om-ui') })
// eye on the deck 3 m south-west of the fountain, looking at its middle basin
await p.goto('http://localhost:4319/#cam=10200,1600,3300,12240,1300,1160', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Walkthrough', exact: true }).click({ force: true })
await p.waitForTimeout(7000)
await p.screenshot({ path: `${OUT}/fountain-1.png`, timeout: 180000 })
console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no page errors')
await b.close()
