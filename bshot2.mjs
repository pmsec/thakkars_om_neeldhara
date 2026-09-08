import { chromium } from 'playwright'
const OUT = '/tmp/claude-0/-home-user-thakkars-om-neeldhara/4e8dde07-f9e2-5065-b7c3-740ca7938d67/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
p.setDefaultTimeout(180000)
const errs = []
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
await p.goto('http://localhost:4319/', { waitUntil: 'networkidle' })
await p.evaluate(() => { localStorage.setItem('om-active-home', 'om-neeldhara'); localStorage.removeItem('om-ui') })
// eye 2.2 m south-east of the bar at standing height, looking at the machine
await p.goto('http://localhost:4319/#cam=17000,1550,4700,16050,1000,2900', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Walkthrough', exact: true }).click({ force: true })
await p.waitForTimeout(7000)
await p.screenshot({ path: `${OUT}/bar-1.png`, timeout: 180000 })
await p.goto('http://localhost:4319/#cam=16300,1400,3900,16100,1000,2950', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Walkthrough', exact: true }).click({ force: true })
await p.waitForTimeout(7000)
await p.screenshot({ path: `${OUT}/bar-2.png`, timeout: 180000 })
console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no page errors')
await b.close()
