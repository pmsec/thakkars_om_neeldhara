import { chromium } from 'playwright'
const OUT = '/tmp/claude-0/-home-user-thakkars-om-neeldhara/4e8dde07-f9e2-5065-b7c3-740ca7938d67/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
p.setDefaultTimeout(180000)
const errs = []
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
await p.goto('http://localhost:4319/', { waitUntil: 'networkidle' })
await p.evaluate(() => { localStorage.setItem('om-active-home', 'om-neeldhara'); localStorage.removeItem('om-ui') })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Walkthrough', exact: true }).click({ force: true })
await p.waitForTimeout(6000)
await p.selectOption('select', 'R-K-DEN')
await p.getByRole('button', { name: 'N', exact: true }).click({ force: true })
await p.waitForTimeout(2000)
// turn a little west toward the bar by dragging the view
await p.mouse.move(750, 500); await p.mouse.down(); await p.mouse.move(1050, 520, { steps: 8 }); await p.mouse.up()
await p.waitForTimeout(3000)
await p.screenshot({ path: `${OUT}/bar-den-NW.png`, timeout: 180000 })
console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no page errors')
await b.close()
