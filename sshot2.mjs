import { chromium } from 'playwright'
const OUT = '/tmp/claude-0/-home-user-thakkars-om-neeldhara/4e8dde07-f9e2-5065-b7c3-740ca7938d67/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
p.setDefaultTimeout(180000)
await p.goto('http://localhost:4319/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.setItem('om-active-home', 'om-neeldhara'))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Walkthrough', exact: true }).click({ force: true })
await p.waitForTimeout(6000)
await p.selectOption('select', 'R-ENTRY')
await p.getByRole('button', { name: 'N', exact: true }).click({ force: true })
await p.waitForTimeout(2000)
await p.mouse.move(750, 600)
for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(400) }
await p.waitForTimeout(3000)
await p.screenshot({ path: `${OUT}/sconce-entry-wide.png`, timeout: 180000 })
await b.close()
