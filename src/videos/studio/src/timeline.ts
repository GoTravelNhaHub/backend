// Stage 3a — the timeline: scene clock, narration placement, word-timed captions, resolved zoom paths.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  DATA_ROOT, type Brand, type CaptureManifest, type Located, type SceneConfig, type VideoConfig,
} from './lib.ts'
import { buildCaptions, type Caption } from './subtitles.ts'
import type { VoiceManifest } from './voice.ts'

/** Zoom keyframe resolved to master-pixel center. */
export interface ResolvedKey { t: number; scale: number; cx: number; cy: number }

export interface TimelineScene extends Omit<SceneConfig, 'zoom'> {
  start: number
  end: number
  kind: 'video' | 'image'
  file: string
  /** Source size (capture master for video, screenshot size for images). */
  srcW: number
  srcH: number
  zoom: ResolvedKey[]
  /** Controls/elements located during capture, in shot time. */
  located: Located[]
  available?: number
}

export interface NarrationPlacement {
  id: string
  start: number
  end: number
  duration: number
  file: string
  caption: string
  speak: string
  window: [number, number]
  overflow: number
  wordStarts: number[]
  timing: 'provider' | 'estimated'
}

export interface Timeline {
  id: string
  title: string
  destination: string
  generatedAt: string
  video: VideoConfig['video']
  brand: Brand
  logo?: string
  tagline?: string
  voice: { provider: VoiceManifest['provider']; voice: string; production: boolean; tempo: number }
  music: VideoConfig['music']
  scenes: TimelineScene[]
  narration: NarrationPlacement[]
  captions: Caption[]
  websiteFootageSeconds: number
  skippedFeatures: { id: string; reason: string }[]
  warnings: string[]
}

const GAP = 0.15
/** Mobile pages keep ~4.4% side padding; 1.07x zoom stays inside it. */
const SAFE_FOOTAGE_ZOOM = 1.07
const smooth = (u: number) => u * u * (3 - 2 * u)

/** Zoom state at scene time t (smoothstep between keyframes). */
export function zoomAt(keys: ResolvedKey[], t: number): { scale: number; cx: number; cy: number } {
  if (t <= keys[0].t) return keys[0]
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t <= b.t) {
      const u = smooth((t - a.t) / Math.max(1e-6, b.t - a.t))
      return { scale: a.scale + (b.scale - a.scale) * u, cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u }
    }
  }
  return keys[keys.length - 1]
}

/** Visible window (source px) for a zoom state, clamped inside the frame. */
export function windowFor(z: { scale: number; cx: number; cy: number }, srcW: number, srcH: number) {
  const w = srcW / z.scale
  const h = srcH / z.scale
  const x = Math.max(0, Math.min(srcW - w, z.cx - w / 2))
  const y = Math.max(0, Math.min(srcH - h, z.cy - h / 2))
  return { x, y, w, h }
}

/** Maps a source-pixel rect to output pixels at scene time t. */
export function toOutput(scene: TimelineScene, r: { x: number; y: number; w: number; h: number }, t: number, outW: number, outH: number) {
  const win = windowFor(zoomAt(scene.zoom, t), scene.srcW, scene.srcH)
  const k = outW / win.w
  return { x: (r.x - win.x) * k, y: (r.y - win.y) * (outH / win.h), w: r.w * k, h: r.h * (outH / win.h) }
}

function place(cfg: VideoConfig, durations: number[]) {
  const out: { start: number; end: number }[] = []
  let cursor = 0
  cfg.narration.forEach((line, i) => {
    const start = Math.max(line.window[0], cursor + (i ? GAP : 0))
    out.push({ start, end: start + durations[i] })
    cursor = start + durations[i]
  })
  return out
}

export function buildTimeline(cfg: VideoConfig, manifest: CaptureManifest, voice: VoiceManifest): Timeline {
  const warnings: string[] = []
  const D = cfg.video.duration
  const limit = D - 0.4

  // --- narration: start in its window; speed up (≤ maxTempo) only if the whole script would overrun.
  const clips = cfg.narration.map(l => voice.clips.find(c => c.id === l.id)!)
  let tempo = 1
  let durations = clips.map(c => c.duration)
  let placed = place(cfg, durations)
  while (placed[placed.length - 1].end > limit && tempo < cfg.voice.maxTempo - 1e-9) {
    tempo = Math.min(cfg.voice.maxTempo, +(tempo + 0.02).toFixed(2))
    durations = clips.map(c => c.duration / tempo)
    placed = place(cfg, durations)
  }
  if (placed[placed.length - 1].end > limit) {
    throw new Error(`Narration runs to ${placed[placed.length - 1].end.toFixed(2)}s even at ${tempo}x; shorten the script`)
  }
  if (tempo !== 1) warnings.push(`narration sped up ${tempo}x to fit ${D}s`)

  const narration: NarrationPlacement[] = cfg.narration.map((line, i) => {
    const overflow = +Math.max(0, placed[i].end - line.window[1]).toFixed(2)
    if (overflow > 0.4) warnings.push(`narration "${line.id}" runs ${overflow}s past its ${line.window.join('–')}s window`)
    return {
      id: line.id, caption: line.caption, speak: line.speak, window: line.window, overflow,
      start: +placed[i].start.toFixed(3), end: +placed[i].end.toFixed(3), duration: +durations[i].toFixed(3),
      file: join(DATA_ROOT, clips[i].file), wordStarts: clips[i].wordStarts.map(w => +(w / tempo).toFixed(3)), timing: clips[i].timing,
    }
  })

  // --- scenes
  const total = cfg.scenes.reduce((a, s) => a + s.duration, 0)
  if (Math.abs(total - D) > 1e-6) throw new Error(`scene durations add up to ${total}s, expected ${D}s`)
  let clock = 0
  let websiteFootageSeconds = 0
  const scenes: TimelineScene[] = cfg.scenes.map(sc => {
    const start = clock
    clock += sc.duration
    let file: string
    let kind: 'video' | 'image'
    let located: Located[] = []
    let available: number | undefined
    const { width: srcW, height: srcH } = manifest.master
    if (sc.source.type === 'video') {
      const shot = manifest.shots[sc.source.shot]
      if (!shot || shot.status !== 'ok' || !shot.video) throw new Error(`scene "${sc.id}" needs shot "${sc.source.shot}" (${shot?.reason ?? 'not captured'})`)
      file = join(DATA_ROOT, shot.video)
      kind = 'video'
      located = shot.located
      available = +((shot.duration ?? 0) - sc.source.from).toFixed(2)
      if (available < sc.duration) warnings.push(`scene "${sc.id}": ${available}s of footage for ${sc.duration}s; last frame held`)
      websiteFootageSeconds += sc.duration
    } else {
      const shot = manifest.screenshots[sc.source.screenshot]
      if (!shot) throw new Error(`scene "${sc.id}" needs screenshot "${sc.source.screenshot}"`)
      file = join(DATA_ROOT, shot)
      kind = 'image'
    }
    if (!existsSync(file)) throw new Error(`scene "${sc.id}": missing ${file}`)
    const from = sc.source.type === 'video' ? sc.source.from : 0
    const keys = (sc.zoom?.length ? sc.zoom : [{ t: 0, scale: 1, center: [0.5, 0.5] as [number, number] }]).map(k => {
      let cx = srcW / 2
      let cy = srcH / 2
      let scale = Math.max(1, k.scale)
      if (k.target) {
        // Each named element at its position nearest to the moment the keyframe is shown; zoom on their union.
        const shotT = from + k.t
        const rects = (Array.isArray(k.target) ? k.target : [k.target]).flatMap(name => {
          const hit = located.filter(l => l.name === name).sort((a, b) => Math.abs(a.t - shotT) - Math.abs(b.t - shotT))[0]
          if (!hit) warnings.push(`scene "${sc.id}": zoom target "${name}" was not located`)
          return hit ? [hit] : []
        })
        if (rects.length) {
          const x0 = Math.min(...rects.map(r => r.x))
          const y0 = Math.min(...rects.map(r => r.y))
          const x1 = Math.max(...rects.map(r => r.x + r.w))
          const y1 = Math.max(...rects.map(r => r.y + r.h))
          cx = (x0 + x1) / 2
          cy = (y0 + y1) / 2
          if (!k.allowCrop) {
            // Stay centered on the page column and keep the whole target (plus 1% margin) in frame,
            // so zooms never cut words off at the edges of this full-width mobile layout.
            cx = srcW / 2
            const half = Math.max(srcW / 2 - x0, x1 - srcW / 2) + srcW * 0.01
            scale = Math.min(scale, srcW / (2 * half))
          }
        }
      } else if (k.center) {
        cx = k.center[0] * srcW
        cy = k.center[1] * srcH
      }
      // Website footage: never crop into the page's side padding unless explicitly allowed.
      if (kind === 'video' && !k.allowCrop) { scale = Math.min(scale, SAFE_FOOTAGE_ZOOM); cx = srcW / 2 }
      return { t: k.t, scale: +Math.max(1, scale).toFixed(4), cx: Math.round(cx), cy: Math.round(cy) }
    })
    const { zoom: _z, ...rest } = sc
    return { ...rest, start, end: clock, kind, file, srcW, srcH, zoom: keys, located, available }
  })
  if (websiteFootageSeconds < 30) warnings.push(`only ${websiteFootageSeconds}s of website footage (target ≥ 30s)`)

  const captions = buildCaptions(
    narration.map((n, i) => ({
      id: n.id, start: n.start, end: n.end, caption: n.caption, speak: n.speak, wordStarts: n.wordStarts,
      nextStart: narration[i + 1]?.start ?? D,
    })),
    cfg.subtitles.maxCharsPerLine, cfg.subtitles.maxLines,
  )

  return {
    id: cfg.id, title: cfg.title, destination: cfg.destination, generatedAt: new Date().toISOString(), video: cfg.video,
    brand: manifest.brand, logo: manifest.logo ? join(DATA_ROOT, manifest.logo) : undefined, tagline: cfg.cta.tagline ?? manifest.tagline,
    voice: { provider: voice.provider, voice: voice.voice, production: voice.production, tempo },
    music: cfg.music, scenes, narration, captions, websiteFootageSeconds,
    skippedFeatures: Object.values(manifest.shots).filter(s => s.status !== 'ok').map(s => ({ id: s.id, reason: s.reason ?? s.status })),
    warnings,
  }
}

/** Scene active at absolute time t. */
export const sceneAt = (tl: Timeline, t: number) => tl.scenes.find(s => t >= s.start && t < s.end) ?? tl.scenes[tl.scenes.length - 1]

/** Union rectangle (source px) of named located elements nearest to shot time t. */
export function locatedUnion(scene: TimelineScene, target: string | string[], shotT: number) {
  const rects = (Array.isArray(target) ? target : [target]).flatMap(name => {
    const hit = scene.located.filter(l => l.name === name).sort((a, b) => Math.abs(a.t - shotT) - Math.abs(b.t - shotT))[0]
    return hit ? [hit] : []
  })
  if (!rects.length) return null
  const x = Math.min(...rects.map(r => r.x))
  const y = Math.min(...rects.map(r => r.y))
  return { x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y }
}
