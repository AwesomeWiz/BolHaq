/* global document, localStorage, window */
import console from 'node:console'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import process from 'node:process'

const load = createRequire(import.meta.url)
const { chromium, webkit } = load('playwright-core')
const axe = load.resolve('axe-core/axe.min.js')
const origin = process.env.BOLHAQ_QA_URL ?? 'http://127.0.0.1:4174/'
const cases = [
  { locale: 'en-IN', site: 'North Construction and Infrastructure Works, Building Annex Section Eight'.slice(0, 80),
    payment: 'I received Rs 300', amount: '300' },
  { locale: 'hi-IN', site: 'उत्तर निर्माण और बुनियादी ढाँचा परियोजना की मुख्य इमारत वाला कार्यस्थल',
    payment: 'मुझे आईएनआर 2000 मिले', amount: '2000' },
  { locale: 'ml-IN', site: 'വടക്കൻകൊച്ചിയിലെനിർമ്മാണപ്രവർത്തനങ്ങൾനടക്കുന്നപ്രധാനജോലിസ്ഥലം',
    payment: 'എനിക്ക് ആയിരം രൂപ കിട്ടി', amount: '1000' },
]
const widths = [320, 360, 375, 390, 430, 768, 1440]

async function layoutMatrix(page, locale, hasWorksite) {
  for (const zoom of [100, 200]) {
    await page.evaluate(zoom => { document.documentElement.style.fontSize = zoom + '%' }, zoom)
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 })
      const layout = await page.evaluate(() => {
        const card = document.querySelector('.employer-card')
        const button = card.querySelector('.add-worksite')
        const headingText = document.createRange()
        headingText.selectNodeContents(card.querySelector('h2'))
        const heading = headingText.getBoundingClientRect()
        const action = button.getBoundingClientRect()
        const bounds = card.getBoundingClientRect()
        return {
          overlap: heading.left < action.right && heading.right > action.left &&
            heading.top < action.bottom && heading.bottom > action.top,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          actionFits: action.left >= bounds.left && action.right <= bounds.right &&
            action.height >= 48 && button.scrollWidth <= button.clientWidth + 1,
          stacked: action.top >= heading.bottom,
          cardWidth: bounds.width,
        }
      })
      const label = `${locale} width ${width}, text ${zoom}%, ${hasWorksite ? 'with' : 'without'} a worksite`
      assert.equal(layout.overlap, false, label)
      assert.ok(layout.overflow <= 1, label + ' horizontal overflow ' + JSON.stringify(layout))
      assert.ok(layout.actionFits, label)
      if (!hasWorksite && width <= 430 && zoom === 200) assert.equal(layout.stacked, true, label)
      if (!hasWorksite && width === 320) assert.equal(layout.stacked, true, label)
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '' })
  await page.setViewportSize({ width: 390, height: 844 })
}

async function addWorksite(page, site) {
  await page.locator('.add-worksite').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('input[name="name"]').fill(site)
  await dialog.locator('input[name="rate"]').fill('700')
  await dialog.locator('button[type="submit"]').click()
  await dialog.locator('.dialog-actions .primary').click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.employer-select option:checked').textContent(), site)
}

async function audit(page, label) {
  await page.addScriptTag({ path: axe })
  const issues = await page.evaluate(async () => (await window.axe.run({
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })).violations.map(item => ({ rule: item.id, nodes: item.nodes.map(node => node.target) })))
  assert.deepEqual(issues, [], label)
}

async function checkSpotlight(page, step) {
  await page.waitForFunction(step => {
    const target = document.querySelector(`[data-tour-target="${step}"]`)?.getBoundingClientRect()
    const panel = document.querySelector('.tour-panel')?.getBoundingClientRect()
    const highlight = document.querySelector('.tour-spotlight')?.getBoundingClientRect()
    return target && panel && highlight && target.top >= 0 && target.bottom + 5 <= panel.top &&
      Math.abs(target.left - highlight.left - 5) <= 1 && Math.abs(target.top - highlight.top - 5) <= 1
  }, step)
}

async function tour(page) {
  await page.locator('.voice-guide .primary').click()
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '1')
  await checkSpotlight(page, 'language')
  await audit(page, 'tour starts with accessible name, progress and actions')
  await page.locator('.language-trigger').click()
  await page.getByRole('option', { name: 'മലയാളം' }).click()
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '1')
  await page.locator('.language-trigger').click()
  await page.getByRole('option', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await checkSpotlight(page, 'site')
  await page.locator('.add-worksite').click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.getByRole('progressbar').count(), 0)
  await page.keyboard.press('Escape')
  await checkSpotlight(page, 'site')
  await page.getByRole('button', { name: 'Next' }).click()
  await checkSpotlight(page, 'mic')
  await page.getByRole('button', { name: 'Next' }).click()
  assert.ok(await page.getByText('Example only. Nothing here is saved.').isVisible())
  await page.getByRole('button', { name: 'Next' }).click()
  await checkSpotlight(page, 'reports')
  await page.getByRole('button', { name: 'Finish' }).click()
  assert.equal(await page.evaluate(() => localStorage.getItem('bolhaq-guide-complete')), 'completed')
  assert.equal(await page.locator('.employer-select').count(), 0)
}

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch(engine === chromium ? { executablePath: process.env.BOLHAQ_QA_CHROME } : {})
  try {
    const speechInfo = []
    for (const { locale, site, payment, amount } of cases) {
      const context = await browser.newContext({
        isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
      })
      await context.addInitScript(locale => {
        class Recognition {
          start() { window.qaRecognition = this; this.onstart?.() }
          stop() {}
          abort() {}
        }
        localStorage.setItem('bolhaq-language', locale)
        window.SpeechRecognition = Recognition
      }, locale)
      const page = await context.newPage()
      page.setDefaultTimeout(9000)
      await page.goto(origin + '?speech-debug=1')
      await page.locator('.add-worksite').waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.locator('.speech-diagnostics').count(), 0)
      await layoutMatrix(page, locale, false)
      if (locale === 'en-IN') await tour(page)
      await addWorksite(page, site)
      await layoutMatrix(page, locale, true)
      await page.locator('.mic-button').click()
      await page.evaluate(transcript => {
        const recognition = window.qaRecognition
        recognition.onresult({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal: true })] })
        recognition.onend?.()
      }, payment)
      assert.equal(await page.locator('dialog[open] input[name="amount"]').inputValue(), amount)
      assert.equal(await page.evaluate(() => window.qaRecognition.lang), locale)
      await page.keyboard.press('Escape')
      await audit(page, `${locale} ledger accessibility`)
      assert.equal(await page.locator('.transactions li').count(), 0)
      const voices = await page.evaluate(() => [...new Set(window.speechSynthesis?.getVoices().map(voice => voice.lang) ?? [])])
      speechInfo.push([locale, voices])
      await context.close()
    }
    console.log(`${engine.name()} ${browser.version()}: 84 layout cases, spotlight, speech-result prefill and cancellation, axe passed`)
    console.log('Browser-reported voice locales:', JSON.stringify(speechInfo[0][1]))
  } finally {
    await browser.close()
  }
}
