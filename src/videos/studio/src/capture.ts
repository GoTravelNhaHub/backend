// Records real footage of the public GoTravelNha site with Playwright + Chromium.
// No login, no credentials. Tracking/analytics requests are blocked so captures do not pollute production data.
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright'
import {
  DATA_ROOT, dirs, ensureDir, ffmpeg, loadConfig, log, mediaDuration, readJson, requireBinaries, retry, writeJson,
  type Brand, type CaptureManifest, type Located, type ShotConfig, type ShotResult, type Step, type VideoConfig,
} from './lib.ts'

const FALLBACK_BRAND: Brand = {
  primary: '#0066E4', primaryHover: '#0057C8', ink: '#0A1024', canvas: '#F7F9FD', wordmark: '#0055D9', source: 'fallback',
}

const rel = (p: string) => relative(DATA_ROOT, p)

async function newContext(browser: Browser, cfg: VideoConfig): Promise<BrowserContext> {
  const { viewport, deviceScaleFactor } = cfg.capture
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    locale: cfg.site.locale,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 GoTravelNhaVideoStudio',
  })
  // tsx (esbuild keepNames) wraps named functions in __name(); define it so page.evaluate callbacks run.
  await context.addInitScript({ content: 'window.__name = (fn) => fn' })
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value) } catch {}
  }, [cfg.site.langStorageKey, cfg.site.langValue])
  await context.route('**/*', route => {
    const url = route.request().url()
    if (cfg.site.blockRequestPatterns.some(p => url.includes(p))) return route.abort()
    return route.continue()
  })
  return context
}

/** Load a page and wait until it is hydrated, translated and its images are decoded. */
async function openPage(page: Page, cfg: VideoConfig, path: string) {
  const url = new URL(path, cfg.site.baseUrl).toString()
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.capture.navigationTimeoutMs })
  if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status()} for ${url}`)
  await page.waitForLoadState('networkidle', { timeout: cfg.capture.navigationTimeoutMs }).catch(() => {})
  await page.locator('main, h1').first().waitFor({ state: 'visible', timeout: cfg.capture.stepTimeoutMs })
  // Server renders English; the client switches to the saved language after hydration.
  await page.waitForFunction(lang => document.documentElement.lang === lang, cfg.site.langValue, { timeout: cfg.capture.stepTimeoutMs })
    .catch(() => log('capture', `${path}: <html lang> never became "${cfg.site.langValue}"; continuing`))
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' })
  await page.evaluate(() => document.fonts.ready)
  // Walk the page once so lazy images load, then return to the top.
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight
    for (let y = 0; y < h; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y)
      await new Promise(r => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.evaluate(() =>
    Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r }))),
  )
  await page.waitForTimeout(400)
}

async function smoothScrollTo(page: Page, targetY: number, ms: number) {
  await page.evaluate(([target, duration]) => new Promise<void>(resolvePromise => {
    const startY = window.scrollY
    const max = document.documentElement.scrollHeight - window.innerHeight
    const end = Math.max(0, Math.min(max, target))
    const t0 = performance.now()
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      window.scrollTo(0, startY + (end - startY) * ease(p))
      if (p < 1) requestAnimationFrame(tick)
      else resolvePromise()
    }
    requestAnimationFrame(tick)
  }), [targetY, ms] as const)
}

async function textY(page: Page, text: string, timeout: number): Promise<number> {
  const exact = page.getByText(text, { exact: true }).first()
  const loc = (await exact.count()) ? exact : page.getByText(text).first()
  await loc.waitFor({ state: 'attached', timeout })
  return loc.evaluate(el => el.getBoundingClientRect().top + window.scrollY)
}

/** Injects a pointer cursor (an on-screen annotation, not part of the site) used to show where real clicks happen. */
async function ensureCursor(page: Page) {
  await page.evaluate(() => {
    if (document.getElementById('__vs_cursor')) return
    const c = document.createElement('div')
    c.id = '__vs_cursor'
    c.innerHTML = '<svg width="30" height="38" viewBox="0 0 30 38"><path d="M3 2 L3 31 L10.5 24.5 L15.5 35.5 L20.5 33.3 L15.6 22.6 L25.5 22.2 Z" ' +
      'fill="#fff" stroke="#0A1024" stroke-width="2.4" stroke-linejoin="round"/></svg>'
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;display:none;' +
      'filter:drop-shadow(0 3px 5px rgba(10,16,36,.35));transform-origin:3px 2px;will-change:transform'
    document.body.appendChild(c)
  })
}

async function setCursor(page: Page, state: { x?: number; y?: number; show?: boolean; press?: boolean }) {
  await ensureCursor(page)
  await page.evaluate(st => {
    const c = document.getElementById('__vs_cursor') as HTMLElement & { _x?: number; _y?: number }
    if (st.x !== undefined) { c._x = st.x; c._y = st.y }
    if (st.show !== undefined) c.style.display = st.show ? 'block' : 'none'
    c.style.transform = `translate(${c._x ?? 0}px, ${c._y ?? 0}px) scale(${st.press ? 0.82 : 1})`
  }, state)
}

async function cursorPos(page: Page, vw: number, vh: number): Promise<{ x: number; y: number }> {
  await ensureCursor(page)
  return page.evaluate(([w, h]) => {
    const c = document.getElementById('__vs_cursor') as HTMLElement & { _x?: number; _y?: number }
    return { x: c._x ?? w * 0.72, y: c._y ?? h * 0.62 }
  }, [vw, vh] as const)
}

/** Shows a short tap ripple where a real click happens, so viewers can follow the interaction. */
async function showTap(page: Page, x: number, y: number) {
  await page.evaluate(([cx, cy]) => {
    const dot = document.createElement('div')
    dot.style.cssText = `position:fixed;left:${cx - 26}px;top:${cy - 26}px;width:52px;height:52px;border-radius:50%;` +
      'background:rgba(0,102,228,.25);border:3px solid rgba(0,102,228,.8);z-index:2147483646;pointer-events:none;' +
      'transform:scale(.35);opacity:1;transition:transform .5s ease-out,opacity .6s ease-out .3s'
    document.body.appendChild(dot)
    requestAnimationFrame(() => { dot.style.transform = 'scale(1.35)'; dot.style.opacity = '0' })
    setTimeout(() => dot.remove(), 1100)
  }, [x, y] as const)
}

function findElement(page: Page, opts: { text?: string; selector?: string; role?: 'button' | 'link' | 'tab' }): Locator {
  if (opts.selector) return page.locator(opts.selector).filter({ visible: true }).first()
  const text = opts.text!
  if (opts.role) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const sel = opts.role === 'link' ? 'a, [role="link"]' : opts.role === 'tab' ? '[role="tab"], button' : 'button, [role="button"], [role="tab"]'
    return page.locator(sel).filter({ hasText: new RegExp(`^\\s*${escaped}`) }).filter({ visible: true }).first()
  }
  return page.getByText(text, { exact: true }).filter({ visible: true }).first()
}

interface StepContext {
  page: Page
  cfg: VideoConfig
  screenshots: Record<string, string>
  located: Located[]
  rec?: FrameRecorder
  now: () => number
  shotsDir: string
}

async function rectOf(ctx: StepContext, loc: Locator, name: string, control: boolean) {
  const box = await loc.boundingBox()
  if (!box) throw new Error(`"${name}" has no box`)
  const k = ctx.cfg.capture.deviceScaleFactor
  const r: Located = {
    name, t: +ctx.now().toFixed(3), control,
    x: Math.round(box.x * k), y: Math.round(box.y * k), w: Math.round(box.width * k), h: Math.round(box.height * k),
  }
  ctx.located.push(r)
  return box
}

async function runStep(ctx: StepContext, step: Step) {
  const { page, cfg, rec } = ctx
  const scroll = (y: number, ms: number) => (rec ? rec.scrollTo(y, ms) : smoothScrollTo(page, y, ms))
  const timeout = cfg.capture.stepTimeoutMs
  const { width: vw, height: vh } = cfg.capture.viewport
  switch (step.action) {
    case 'wait':
      if (rec) await rec.hold(step.ms)
      else await page.waitForTimeout(step.ms)
      return
    case 'mark':
      return
    case 'cursor':
      await setCursor(page, step.show ? { show: true, ...(await cursorPos(page, vw, vh)) } : { show: false })
      return
    case 'screenshot': {
      const file = join(ctx.shotsDir, `${step.name}.png`)
      const hidden = await page.evaluate(() => {
        const c = document.getElementById('__vs_cursor')
        const was = c?.style.display
        if (c) c.style.display = 'none'
        return was
      })
      await page.screenshot({ path: file, animations: 'disabled', timeout, scale: 'device' })
      if (hidden) await page.evaluate(d => { const c = document.getElementById('__vs_cursor'); if (c) c.style.display = d }, hidden)
      ctx.screenshots[step.name] = rel(file)
      return
    }
    case 'scrollBy': {
      const y = await page.evaluate(() => window.scrollY)
      await scroll(y + step.px, step.ms)
      return
    }
    case 'scrollToText': {
      const y = await textY(page, step.text, timeout)
      await scroll(y - (step.offset ?? 80), step.ms)
      return
    }
    case 'jumpToText': {
      const y = await textY(page, step.text, timeout)
      await page.evaluate(top => window.scrollTo(0, top), y - (step.offset ?? 80))
      await page.waitForTimeout(500)
      return
    }
    case 'locate': {
      const loc = findElement(page, step)
      await loc.waitFor({ state: 'visible', timeout })
      await rectOf(ctx, loc, step.name, !!step.control)
      return
    }
    case 'click': {
      const el = findElement(page, step)
      await el.waitFor({ state: 'visible', timeout })
      let box = await el.boundingBox()
      if (!box || box.y < 80 || box.y + box.height > vh - 100) {
        const y = await el.evaluate(e => e.getBoundingClientRect().top + window.scrollY)
        await scroll(y - vh * 0.42, 900)
        box = await el.boundingBox()
      }
      if (!box) throw new Error(`"${step.text}" has no box`)
      const tx = box.x + Math.min(box.width / 2, 60)
      const ty = box.y + box.height / 2
      // Glide the cursor to the real element, press, click.
      const from = await cursorPos(page, vw, vh)
      await setCursor(page, { show: true })
      const n = Math.max(1, Math.round(((step.moveMs ?? 650) / 1000) * cfg.video.fps))
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
      for (let i = 1; i <= n; i++) {
        const p = ease(i / n)
        await setCursor(page, { x: from.x + (tx - from.x) * p, y: from.y + (ty - from.y) * p })
        if (rec) await rec.frame()
      }
      await rectOf(ctx, el, step.name ?? step.text, true)
      await setCursor(page, { press: true })
      await showTap(page, tx, ty)
      if (rec) { await rec.frame(); await rec.frame() }
      const before = page.url()
      await el.click({ timeout })
      await setCursor(page, { press: false })
      if (step.navigates) {
        // Same-site navigation: hide the cursor (so it never seems to hover the next page), keep recording the
        // real transition, then wait for the new page to settle.
        if (rec) await rec.hold(250)
        await setCursor(page, { show: false })
        if (rec) await rec.hold(650)
        await page.waitForURL(u => u.toString() !== before, { timeout })
        const host = new URL(cfg.site.baseUrl).host
        if (new URL(page.url()).host !== host) throw new Error(`click left the site: ${page.url()}`)
        await page.waitForLoadState('networkidle', { timeout }).catch(() => {})
      } else {
        await page.waitForTimeout(120)
        if (page.url() !== before) throw new Error(`click on "${step.text}" navigated to ${page.url()}`)
      }
      return
    }
  }
}

/**
 * Frame recorder. Chromium's screencast and Playwright's recordVideo both deliver CSS-pixel frames (432x768),
 * which look soft at 1080x1920. Instead every output frame is a real device-resolution screenshot:
 * scroll animations are stepped exactly once per output frame, waits are sampled in real time.
 */
class FrameRecorder {
  frames: { file: string; dur: number }[] = []
  constructor(private page: Page, private dir: string, private fps: number) {}

  private async shot() {
    const file = join(this.dir, `frame-${String(this.frames.length).padStart(5, '0')}.jpg`)
    await this.page.screenshot({ path: file, type: 'jpeg', quality: 92, scale: 'device', caret: 'hide' })
    return file
  }

  /** One frame of virtual time (used while animating the cursor). */
  async frame() {
    this.frames.push({ file: await this.shot(), dur: 1 / this.fps })
  }

  get seconds() {
    return this.frames.reduce((sum, f) => sum + f.dur, 0)
  }

  /** Real-time sampling: each screenshot lasts as long as it took to take the next one. */
  async hold(ms: number) {
    const end = Date.now() + ms
    let t = Date.now()
    do {
      const file = await this.shot()
      const now = Date.now()
      this.frames.push({ file, dur: Math.max(1 / this.fps, (now - t) / 1000) })
      t = now
    } while (Date.now() < end)
  }

  /** Virtual-time scroll: one frame per 1/fps of animation, eased. */
  async scrollTo(targetY: number, ms: number) {
    const { start, end } = await this.page.evaluate(target => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      return { start: window.scrollY, end: Math.max(0, Math.min(max, target)) }
    }, targetY)
    const n = Math.max(1, Math.round((ms / 1000) * this.fps))
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    for (let i = 1; i <= n; i++) {
      await this.page.evaluate(y => window.scrollTo(0, y), Math.round(start + (end - start) * ease(i / n)))
      this.frames.push({ file: await this.shot(), dur: 1 / this.fps })
    }
  }

  /** Encodes at master resolution (viewport × deviceScaleFactor) so the composer can zoom without upscaling. */
  async encode(cfg: VideoConfig, listFile: string, outFile: string) {
    if (this.frames.length < 2) throw new Error(`only ${this.frames.length} frame(s) recorded`)
    const lines = this.frames.flatMap(f => [`file '${f.file}'`, `duration ${f.dur.toFixed(4)}`])
    lines.push(`file '${this.frames[this.frames.length - 1].file}'`)
    writeFileSync(listFile, lines.join('\n') + '\n')
    const { width, height } = masterSize(cfg)
    const { fps } = cfg.video
    await ffmpeg([
      '-f', 'concat', '-safe', '0', '-i', listFile,
      // Screenshots are full-range JPEG; convert to limited (TV) range so players get standard yuv420p.
      '-vf', `scale=${width}:${height}:flags=lanczos:in_range=pc:out_range=tv,setsar=1,fps=${fps},format=yuv420p`,
      '-color_range', 'tv',
      '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'medium', '-crf', '13', '-an', '-movflags', '+faststart', outFile,
    ])
  }
}

export const masterSize = (cfg: VideoConfig) => {
  const k = cfg.capture.deviceScaleFactor
  const w = Math.round(cfg.capture.viewport.width * k)
  const h = Math.round(cfg.capture.viewport.height * k)
  return { width: w - (w % 2), height: h - (h % 2) }
}

async function captureShot(browser: Browser, cfg: VideoConfig, shot: ShotConfig, screenshots: Record<string, string>): Promise<ShotResult> {
  const d = dirs(cfg)
  const result: ShotResult = { id: shot.id, url: shot.url, status: 'failed', attempts: 0, log: [], located: [] }
  const rawDir = join(d.capture, 'raw', shot.id)
  const normalized = join(d.capture, `${shot.id}.mp4`)
  try {
    await retry(`capture:${shot.id}`, cfg.capture.retries, async attempt => {
      result.attempts = attempt
      result.log = []
      result.located = []
      rmSync(rawDir, { recursive: true, force: true })
      ensureDir(rawDir)
      const context = await newContext(browser, cfg)
      const page = await context.newPage()
      let skipped: string | undefined
      const ctx: StepContext = {
        page, cfg, screenshots, located: result.located, shotsDir: join(d.capture, 'screenshots'),
        now: () => ctx.rec?.seconds ?? 0,
      }
      try {
        await openPage(page, cfg, shot.url)
        if (shot.skipIfText && (await page.getByText(shot.skipIfText).count())) {
          skipped = `page shows "${shot.skipIfText}"`
        } else {
          const startRecording = () => { ctx.rec = new FrameRecorder(page, rawDir, cfg.video.fps) }
          if (!shot.steps.some(s => s.action === 'mark')) startRecording()
          for (const step of shot.steps) {
            const t = ctx.now()
            if (step.action === 'mark') {
              await page.waitForTimeout(400)
              startRecording()
              continue
            }
            const deadline = cfg.capture.stepTimeoutMs * 2 + ('ms' in step ? step.ms * 4 : 0) + 5000
            try {
              await Promise.race([
                runStep(ctx, step),
                new Promise((_, reject) => setTimeout(() => reject(new Error('step timeout')), deadline)),
              ])
              result.log.push({ t: +t.toFixed(2), action: describe(step), ok: true })
            } catch (err) {
              // A missing element is reported and skipped, never faked.
              result.log.push({ t: +t.toFixed(2), action: describe(step), ok: false, note: (err as Error).message.split('\n')[0] })
              log(`capture:${shot.id}`, `skipped step ${describe(step)}: ${(err as Error).message.split('\n')[0]}`)
            }
          }
          await ctx.rec?.hold(300)
          result.finalUrl = page.url()
        }
      } finally {
        await context.close()
      }
      if (skipped) {
        result.status = 'skipped'
        result.reason = skipped
        return
      }
      const rec = ctx.rec!
      await rec.encode(cfg, join(rawDir, 'frames.txt'), normalized)
      const duration = await mediaDuration(normalized)
      if (duration < 2) throw new Error(`normalized clip too short (${duration}s)`)
      Object.assign(result, { status: 'ok', video: rel(normalized), duration: +duration.toFixed(2), frames: rec.frames.length, ...masterSize(cfg) })
    })
  } catch (err) {
    result.status = 'failed'
    result.reason = (err as Error).message.split('\n')[0]
  }
  if (result.status !== 'ok') rmSync(normalized, { force: true })
  if (process.env.KEEP_RAW_FRAMES !== '1') rmSync(rawDir, { recursive: true, force: true })
  return result
}

function describe(step: Step) {
  switch (step.action) {
    case 'scrollToText':
    case 'jumpToText': return `${step.action}("${step.text}")`
    case 'click': return `click("${step.text}")`
    case 'locate': return `locate(${step.name})`
    case 'cursor': return `cursor(${step.show ? 'on' : 'off'})`
    case 'screenshot': return `screenshot(${step.name})`
    case 'scrollBy': return `scrollBy(${step.px})`
    case 'wait': return `wait(${step.ms})`
    default: return step.action
  }
}

const toHex = (rgb: string) => {
  const m = rgb.match(/\d+(\.\d+)?/g)
  if (!m || m.length < 3 || (m[3] !== undefined && Number(m[3]) === 0)) return null
  return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** Reads brand colors from the live site's computed styles and saves the real logo mark. */
async function captureBrand(browser: Browser, cfg: VideoConfig): Promise<{ brand: Brand; logo?: string; tagline?: string }> {
  const context = await newContext(browser, cfg)
  const page = await context.newPage()
  try {
    await openPage(page, cfg, '/explore')
    const raw = await page.evaluate(() => {
      const cs = (el: Element | null, prop: string) => (el ? getComputedStyle(el).getPropertyValue(prop) : '')
      const submit = document.querySelector('form button[type="submit"]')
      const home = document.querySelector('header a[href="/"]') ?? document.querySelector('a[href="/"]')
      const wordmark = [...(home?.querySelectorAll('*') ?? [])].find(e => e.children.length === 0 && /GoTravelNha/.test(e.textContent ?? ''))
      return {
        primary: cs(submit, 'background-color'),
        ink: cs(document.querySelector('main h2') ?? document.querySelector('h2'), 'color'),
        canvas: cs(document.body, 'background-color'),
        wordmark: cs(wordmark ?? null, 'color'),
        // The header link reads "GoTravelNha" + tagline ("Mơ. Lên kế hoạch. Đi.").
        tagline: (home?.textContent ?? '').replace(/\s+/g, ' ').replace('GoTravelNha', '').trim(),
      }
    })
    const brand: Brand = {
      primary: toHex(raw.primary) ?? FALLBACK_BRAND.primary,
      primaryHover: FALLBACK_BRAND.primaryHover,
      ink: toHex(raw.ink) ?? FALLBACK_BRAND.ink,
      canvas: toHex(raw.canvas) ?? FALLBACK_BRAND.canvas,
      wordmark: toHex(raw.wordmark) ?? FALLBACK_BRAND.wordmark,
      source: toHex(raw.primary) ? 'website' : 'fallback',
    }
    let logo: string | undefined
    const mark = page.locator('a[href="/"]').first().locator('svg, img').first()
    if (await mark.count()) {
      const file = join(dirs(cfg).capture, 'screenshots', 'logo-mark.png')
      await mark.screenshot({ path: file, omitBackground: true, scale: 'device' })
      logo = rel(file)
    }
    log('capture', `brand from ${brand.source}: ${JSON.stringify(brand)}`)
    return { brand, logo, tagline: raw.tagline || undefined }
  } catch (err) {
    log('capture', `brand extraction failed, using fallback: ${(err as Error).message.split('\n')[0]}`)
    return { brand: FALLBACK_BRAND }
  } finally {
    await context.close()
  }
}

async function main() {
  const cfg = loadConfig()
  await requireBinaries(['ffmpeg', 'ffprobe'])
  // CAPTURE_ONLY=shot-a,shot-b re-records just those shots and keeps the rest of the existing manifest.
  const only = process.env.CAPTURE_ONLY?.split(',').filter(Boolean)
  const captureDir = dirs(cfg).capture
  const manifestFile = join(captureDir, 'manifest.json')
  const previous = only && existsSync(manifestFile) ? readJson<CaptureManifest>(manifestFile) : undefined
  if (!previous) rmSync(captureDir, { recursive: true, force: true })
  ensureDir(join(captureDir, 'screenshots'))

  let browser: Browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch (err) {
    throw new Error(`Chromium failed to launch. Run: npx playwright install chromium\n${(err as Error).message}`)
  }
  const manifest: CaptureManifest = {
    videoId: cfg.id, capturedAt: new Date().toISOString(), baseUrl: cfg.site.baseUrl, brand: FALLBACK_BRAND, master: masterSize(cfg),
    shots: { ...previous?.shots }, screenshots: { ...previous?.screenshots },
  }
  try {
    Object.assign(manifest, await captureBrand(browser, cfg))
    for (const shot of cfg.capture.shots) {
      if (only && !only.includes(shot.id)) continue
      log('capture', `shot ${shot.id}: ${shot.description}`)
      const result = await captureShot(browser, cfg, shot, manifest.screenshots)
      manifest.shots[shot.id] = result
      const failedSteps = result.log.filter(l => !l.ok).length
      log('capture', `shot ${shot.id}: ${result.status}${result.reason ? ` (${result.reason})` : ''}` +
        `${result.duration ? `, ${result.duration}s` : ''}${failedSteps ? `, ${failedSteps} step(s) skipped` : ''}`)
    }
  } finally {
    await browser.close()
  }
  writeJson(manifestFile, manifest)

  console.log('\nCapture report')
  for (const r of Object.values(manifest.shots)) {
    console.log(`  ${r.status.padEnd(7)} ${r.id}${r.reason ? ` — ${r.reason}` : ''}`)
    for (const l of r.log.filter(l => !l.ok)) console.log(`          step skipped: ${l.action} — ${l.note}`)
  }
  console.log(`  screenshots: ${Object.keys(manifest.screenshots).join(', ')}`)
  if (!Object.values(manifest.shots).some(r => r.status === 'ok')) {
    console.error('No shots captured successfully.')
    process.exit(1)
  }
  // Every shot a scene depends on must exist; optional ones (not used by any scene) may be skipped.
  const needed = new Set(cfg.scenes.flatMap(s => (s.source.type === 'video' ? [s.source.shot] : [])))
  const missing = [...needed].filter(id => manifest.shots[id]?.status !== 'ok')
  if (missing.length) {
    console.error(`Shots required by scenes were not captured: ${missing.join(', ')}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
