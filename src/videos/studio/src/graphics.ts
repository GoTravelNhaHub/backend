// Stage 3b — text graphics. Captions, scene badges and title cards are rendered by Chromium as transparent PNGs:
// the Homebrew FFmpeg build has no drawtext/libass, and Chromium shapes Vietnamese diacritics correctly.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'
import { ensureDir, log, type Brand, type SceneCard, type SubtitleStyle, type VideoConfig } from './lib.ts'
import { locatedUnion, sceneAt, toOutput, type Timeline } from './timeline.ts'

export interface Graphic { file: string; x: number; y: number; w: number; h: number }

export interface Graphics {
  captions: (Graphic & { fontSize: number })[]
  badges: Record<string, Graphic>
  /** Full-frame overlays per scene; list cards have one layer per reveal step. */
  cards: Record<string, { file: string; at: number }[]>
  spotlights: Record<string, { file: string; at: number; until: number; rect: { x: number; y: number; w: number; h: number } }[]>
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mark = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>')
/** Card text: **highlight** plus authored line breaks (" / "). */
const markLines = (s: string) => s.split(/\s+\/\s+/).map(mark).join('<br>')

function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function baseCss(brand: Brand, font: string) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@500;600;700;800;900&display=block&subset=vietnamese');
  :root { --primary:${brand.primary}; --ink:${brand.ink}; --canvas:${brand.canvas}; --wordmark:${brand.wordmark}; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:transparent; font-family:'${font}', 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing:antialiased; }
  .hl { color:#fff; background:var(--primary); padding:0 .16em; border-radius:.16em; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
  `
}

let htmlLang = 'vi'

async function setHtml(page: Page, brand: Brand, font: string, css: string, body: string) {
  await page.setContent(`<!doctype html><html lang="${htmlLang}"><head><meta charset="utf-8"><style>${baseCss(brand, font)}${css}</style></head><body>${body}</body></html>`,
    { waitUntil: 'load' })
  await Promise.race([page.evaluate(() => document.fonts.ready), page.waitForTimeout(8000)])
}

async function shootElement(page: Page, selector: string, file: string) {
  const el = page.locator(selector)
  const box = await el.boundingBox()
  if (!box) throw new Error(`graphic ${selector} has no box`)
  await el.screenshot({ path: file, omitBackground: true })
  return { w: Math.round(box.width), h: Math.round(box.height) }
}

function logoTag(logo: string | undefined, size: number) {
  if (!logo) return ''
  return `<img src="data:image/png;base64,${readFileSync(logo).toString('base64')}" style="width:${size}px;height:${size}px;object-fit:contain;display:block">`
}

function cardHtml(card: SceneCard, step: number, tl: Timeline, cfg: VideoConfig) {
  switch (card.kind) {
    case 'hook':
      return `<div class="frame hook">
        ${card.kicker ? `<div class="kicker">${esc(card.kicker)}</div>` : ''}
        <h1>${markLines(card.text ?? '')}</h1></div>`
    case 'list': {
      const items = (card.items ?? []).map((it, i) => `<li class="${i < step ? 'on' : ''}"><span class="n">${i + 1}</span>${esc(it)}
        <span class="clock"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span></li>`).join('')
      const footerOn = step > (card.items?.length ?? 0)
      return `<div class="frame list"><h2>${esc(card.title ?? '')}</h2><ul>${items}</ul>
        ${card.footer ? `<div class="footer ${footerOn ? 'on' : ''}">${esc(card.footer)}</div>` : ''}</div>`
    }
    case 'brand':
      return `<div class="frame brandcard"><div class="mark">${logoTag(tl.logo, 220)}</div>
        <div class="word">GoTravelNha</div>${tl.tagline ? `<div class="tag">${esc(tl.tagline)}</div>` : ''}</div>`
    case 'cta':
      return `<div class="frame cta"><div class="panel">
        <div class="brand">${logoTag(tl.logo, 112)}<span>GoTravelNha</span></div>
        <h2>${esc(card.title ?? cfg.cta.title)}</h2>
        <div class="url">${esc(cfg.cta.url)}</div>
        <div class="btn">${esc(cfg.cta.button)} <span>→</span></div>
        ${tl.tagline ? `<div class="tag">${esc(tl.tagline)}</div>` : ''}
      </div></div>`
  }
}

const CARD_CSS = `
  .frame { position:relative; width:1080px; height:1920px; }
  .hook { display:flex; flex-direction:column; justify-content:center; padding:0 84px 330px; }
  .hook .kicker { align-self:flex-start; font-weight:800; font-size:36px; letter-spacing:.08em; text-transform:uppercase; color:#fff;
    background:var(--primary); padding:14px 28px; border-radius:999px; margin-bottom:40px; }
  .hook h1 { color:#fff; font-weight:900; font-size:112px; line-height:1.1; letter-spacing:-.025em; text-shadow:0 6px 34px rgba(0,0,0,.45); }
  .list { display:flex; flex-direction:column; justify-content:center; padding:0 84px 300px; }
  .list h2 { color:#fff; font-weight:800; font-size:70px; line-height:1.15; margin-bottom:56px; text-shadow:0 4px 24px rgba(0,0,0,.4); }
  .list ul { list-style:none; display:flex; flex-direction:column; gap:30px; }
  .list li { display:flex; align-items:center; gap:28px; background:#fff; color:var(--ink); font-weight:800; font-size:58px;
    padding:32px 38px; border-radius:34px; box-shadow:0 18px 40px -16px rgba(0,0,0,.5); opacity:0; }
  .list li.on { opacity:1; }
  .list .n { display:inline-flex; align-items:center; justify-content:center; width:76px; height:76px; border-radius:50%;
    background:var(--primary); color:#fff; font-size:40px; flex:none; }
  .list .clock { margin-left:auto; color:#E26D5A; display:flex; }
  .list .footer { margin-top:56px; align-self:flex-start; color:var(--ink); background:#FFD8CF; font-weight:900; font-size:60px;
    padding:22px 36px; border-radius:26px; opacity:0; }
  .list .footer.on { opacity:1; }
  .brandcard { display:flex; flex-direction:column; align-items:center; justify-content:center; padding-bottom:300px; }
  .brandcard .mark { padding:26px; background:#fff; border-radius:64px; box-shadow:0 30px 70px -24px rgba(10,16,36,.55); margin-bottom:48px; }
  .brandcard .word { color:#fff; font-weight:900; font-size:124px; letter-spacing:-.03em; text-shadow:0 6px 30px rgba(0,0,0,.35); }
  .brandcard .tag { margin-top:24px; color:#fff; font-weight:700; font-size:50px; opacity:.95; text-shadow:0 4px 18px rgba(0,0,0,.35); }
  .cta { display:flex; align-items:center; justify-content:center; padding:0 72px 560px; }
  .cta .panel { width:100%; background:#fff; border-radius:56px; padding:76px 60px 64px; text-align:center;
    box-shadow:0 40px 90px -30px rgba(10,16,36,.6); }
  .cta .brand { display:flex; align-items:center; justify-content:center; gap:24px; margin-bottom:44px; }
  .cta .brand span { color:var(--wordmark); font-weight:900; font-size:80px; letter-spacing:-.02em; }
  .cta h2 { color:var(--ink); font-weight:800; font-size:62px; line-height:1.15; margin-bottom:26px; }
  .cta .url { color:var(--primary); font-weight:900; font-size:74px; margin-bottom:48px; }
  .cta .btn { display:inline-block; background:var(--primary); color:#fff; font-weight:800; font-size:52px; padding:30px 68px;
    border-radius:999px; box-shadow:0 18px 36px -14px rgba(0,102,228,.7); }
  .cta .tag { margin-top:40px; color:#7E8496; font-weight:600; font-size:40px; }
`

function captionCss(s: SubtitleStyle) {
  return `
  .cap { position:absolute; left:0; top:0; white-space:nowrap; padding:20px 36px 24px; border-radius:30px; text-align:center;
    background:${rgba(s.boxColor, s.boxOpacity)}; color:${s.textColor}; font-weight:${s.fontWeight}; font-size:${s.fontSize}px;
    line-height:1.24; letter-spacing:-.005em; box-shadow:0 10px 30px -12px rgba(0,0,0,.5); }
  .cap .hl { background:none; padding:0; color:${s.highlightColor}; }
  `
}

export async function renderGraphics(tl: Timeline, cfg: VideoConfig, dir: string): Promise<Graphics> {
  ensureDir(dir)
  htmlLang = cfg.language.split('-')[0]
  const { width: W, height: H } = tl.video
  const style = cfg.subtitles
  const font = style.fontFamily
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const result: Graphics = { captions: [], badges: {}, cards: {}, spotlights: {} }
  try {
    for (const c of tl.captions) {
      await setHtml(page, tl.brand, font, captionCss(style), `<div class="cap">${c.marked.map(mark).join('<br>')}</div>`)
      // Shrink the font only if a line would leave the safe width.
      const fontSize = await page.evaluate(([maxW, base]) => {
        const el = document.querySelector<HTMLElement>('.cap')!
        let size = base
        while (el.getBoundingClientRect().width > maxW && size > 42) el.style.fontSize = `${--size}px`
        return size
      }, [style.maxWidth, style.fontSize] as const)
      const file = join(dir, `caption-${String(c.index).padStart(2, '0')}.png`)
      const { w, h } = await shootElement(page, '.cap', file)
      const pos = sceneAt(tl, c.start + 0.01).captionPosition ?? 'bottom'
      const x = Math.max(40, Math.min(W - w - 40, Math.round(style.centerX - w / 2)))
      const y = pos === 'top' ? style.topY : style.bottomY - h
      result.captions.push({ file, w, h, x, y, fontSize })
    }

    for (const s of tl.scenes) {
      if (s.badge) {
        await setHtml(page, tl.brand, font, `
          .badge { position:absolute; left:0; top:0; display:flex; align-items:center; gap:18px; padding:14px 32px 14px 16px;
            background:#fff; border-radius:999px; color:var(--ink); font-weight:800; font-size:40px; white-space:nowrap;
            box-shadow:0 14px 34px -12px rgba(10,16,36,.5); border:4px solid var(--primary); }
          .badge .dot { width:62px; height:62px; border-radius:50%; overflow:hidden; display:flex; }
        `, `<div class="badge"><span class="dot">${logoTag(tl.logo, 62)}</span>${esc(s.badge.text)}</div>`)
        const file = join(dir, `badge-${s.id}.png`)
        const { w, h } = await shootElement(page, '.badge', file)
        // Centered, below the Shorts top bar; moved down when captions sit at the top for this scene.
        const y = s.captionPosition === 'top' ? style.topY + 250 : 205
        result.badges[s.id] = { file, w, h, x: Math.round((W - w) / 2), y }
      }
      for (const [i, sp] of (s.spotlight ?? []).entries()) {
        const from = s.source.type === 'video' ? s.source.from : 0
        const src = locatedUnion(s, sp.target, from + sp.at)
        if (!src) { log('graphics', `spotlight ${s.id}/${sp.target} skipped: element not located`); continue }
        const r = toOutput(s, src, sp.at, W, H)
        const pad = 14
        const rect = { x: Math.round(r.x - pad), y: Math.round(r.y - pad), w: Math.round(r.w + pad * 2), h: Math.round(r.h + pad * 2) }
        await setHtml(page, tl.brand, font, `
          .hole { position:absolute; left:${rect.x}px; top:${rect.y}px; width:${rect.w}px; height:${rect.h}px; border-radius:28px;
            box-shadow:0 0 0 3000px rgba(10,16,36,.52), 0 0 0 7px var(--primary), 0 0 38px 10px rgba(0,102,228,.55); }
        `, '<div class="hole"></div>')
        const file = join(dir, `spot-${s.id}-${i}.png`)
        await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } })
        ;(result.spotlights[s.id] ??= []).push({ file, at: sp.at, until: sp.until, rect })
      }
      if (s.card) {
        const steps = s.card.kind === 'list'
          ? [0, ...(s.card.revealAt ?? []), ...(s.card.footer ? [s.card.footerAt ?? s.duration - 1] : [])]
          : [0]
        result.cards[s.id] = []
        for (let i = 0; i < steps.length; i++) {
          await setHtml(page, tl.brand, font, CARD_CSS, cardHtml(s.card, i, tl, cfg))
          const file = join(dir, `card-${s.id}-${i}.png`)
          await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } })
          result.cards[s.id].push({ file, at: steps[i] })
        }
      }
    }
  } finally {
    await browser.close()
  }
  log('graphics', `${result.captions.length} captions, ${Object.keys(result.badges).length} badges, ${Object.keys(result.cards).length} cards`)
  return result
}
