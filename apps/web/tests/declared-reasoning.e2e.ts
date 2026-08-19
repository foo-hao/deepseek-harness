// Web e2e scenario: a hand-declared model's `reasoningEfforts` reaches the
// composer's effort slider — the levels a settings profile declares are exactly
// what the slider offers, and picking one records it with the Agent default.
// Zero model calls: declaring, describing, and switching are settings/llm
// traffic only, so there is no fixture and a stray stream would fail loud.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { ZH_BROWSER_LOCALE, connectFreshWorkspaceZh, saveFailureShot } from './support.ts'

/** Starts the shipped default on this scenario's declared reasoning model. */
const OVERLAY = fileURLToPath(new URL('./declared-reasoning.overlay.yml', import.meta.url))
const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/declared-reasoning', import.meta.url))
const UI_EXPECTED = fileURLToPath(new URL('./snapshots/declared-reasoning/ui.expected.md', import.meta.url))
const MODE = webSnapshotMode()

describe.skipIf(MODE === 'record')('web e2e: declared reasoning efforts reach the composer', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ extraOverlayPath: OVERLAY })
    // The whole reasoning offer is the profile: key = selectable level, value
    // = the wire spelling dispatch would send (`max: ultra` renames; the
    // valueless `off` means "supported, send nothing"). The route sets no
    // deployment default, so the pane leads with the provider-default entry.
    await scaffold.ctx.settings.update(settingsNamespace('llm-pi-ai'), {
      providers: {
        'acme-gateway': {
          displayName: 'Acme Gateway',
          api: 'openai-completions',
          baseURL: 'https://gateway.acme.example/v1',
          models: [{
            id: 'acme-think',
            name: 'Acme Think',
            reasoningEfforts: { off: null, high: 'high', max: 'ultra' },
          }],
        },
      },
    })
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('offers exactly the declared levels on the effort slider and records the picked one', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-declared-reasoning'))
    const trigger = page.getByRole('button', { name: /^选择模型/ })
    await trigger.waitFor({ timeout: 15_000 })
    await trigger.click()

    // The trigger now opens a single-level model list; the effort levels live
    // on the always-visible slider beside it. The slider's golden pins its
    // accessible surface; the menu membership stays a programmatic assertion
    // because its catalog content is scaffold-assembled.
    const menu = page.locator('[role="menu"]')
    await menu.waitFor({ timeout: 10_000 })
    await expect.poll(() => menu.getByRole('menuitemradio', { name: 'Acme Think' }).count(), { timeout: 10_000 }).toBe(1)
    const slider = page.getByRole('slider', { name: '推理等级' })
    await expect.poll(() => slider.getAttribute('aria-valuemax'), { timeout: 10_000 }).toBe('3')
    await expect.poll(() => slider.getAttribute('aria-valuetext'), { timeout: 10_000 }).toBe('Default')
    const sliderSnapshot = await captureStableAria(page, '[role="slider"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(UI_EXPECTED, sliderSnapshot, MODE)

    // The declared levels, nothing else: the provider-default entry (the route
    // configures no `reasoning`), then Off/High/Max — minimal, low, medium,
    // and xhigh were not declared and must not be offered. Stepping to the
    // declared 'High' is the same gesture that saves the default selection, so
    // the effort lands in the Agent default Settings section beside
    // provider/model.
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => slider.getAttribute('aria-valuetext'), { timeout: 10_000 }).toBe('Off')
    await page.keyboard.press('ArrowRight')
    await expect.poll(
      async () => readFile(join(scaffold.harnessHome, 'settings.yaml'), 'utf8'),
      { timeout: 10_000 },
    ).toContain('reasoningEffort: high')
    await expect.poll(() => slider.getAttribute('aria-valuetext'), { timeout: 10_000 }).toBe('High')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => slider.getAttribute('aria-valuetext'), { timeout: 10_000 }).toBe('Max')
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('keeps its snapshot inventory closed', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, ['ui.expected.md'])
  })
})
