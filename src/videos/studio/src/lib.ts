// Shared helpers for the video studio: paths, config, process execution, ffprobe, retries.
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const STUDIO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * Where renders are written. The backend sets VIDEO_STUDIO_DATA_DIR (default backend/storage/video-studio);
 * config `output.*` paths such as "output/x.mp4" resolve against it.
 */
export const DATA_ROOT = resolve(process.env.VIDEO_STUDIO_DATA_DIR ?? STUDIO_ROOT)
export const OUTPUT_DIR = join(DATA_ROOT, 'output')
export const ASSETS_DIR = join(STUDIO_ROOT, 'assets')
/** Video configs. The backend may point this at an editable folder with VIDEO_STUDIO_CONFIG_DIR. */
export const CONFIG_DIR = resolve(process.env.VIDEO_STUDIO_CONFIG_DIR ?? join(STUDIO_ROOT, 'config'))

/** Per-video working folders under output/. */
export const dirs = (cfg: VideoConfig) => ({
  capture: join(OUTPUT_DIR, 'capture', cfg.id),
  voice: join(OUTPUT_DIR, 'voice', cfg.id),
  work: join(OUTPUT_DIR, 'work', cfg.id),
})

// ---------- config schema ----------

export type Step =
  | { action: 'wait'; ms: number }
  | { action: 'mark' }
  | { action: 'screenshot'; name: string }
  | { action: 'scrollBy'; px: number; ms: number }
  | { action: 'scrollToText'; text: string; offset?: number; ms: number }
  | { action: 'jumpToText'; text: string; offset?: number }
  /** Moves the on-screen cursor to a real element and clicks it. `navigates` allows a same-site page change. */
  | { action: 'click'; text: string; role?: 'button' | 'link' | 'tab'; name?: string; navigates?: boolean; moveMs?: number }
  /** Records where a real element is on screen (for zoom targets and caption-overlap checks). */
  | { action: 'locate'; name: string; text?: string; selector?: string; control?: boolean }
  | { action: 'cursor'; show: boolean }

export interface ShotConfig {
  id: string
  url: string
  description: string
  skipIfText?: string
  steps: Step[]
}

export interface NarrationLine {
  id: string
  /** Target window in seconds; the line starts at window[0] or right after the previous line. */
  window: [number, number]
  /** On-screen text. " | " separates subtitle cues, " / " separates lines, **x** highlights. */
  caption: string
  /** Text sent to TTS (may spell brand names phonetically). */
  speak: string
}

export interface SceneCard {
  kind: 'hook' | 'list' | 'brand' | 'cta'
  kicker?: string
  text?: string
  title?: string
  subtitle?: string
  items?: string[]
  revealAt?: number[]
  footer?: string
  footerAt?: number
}

/** Zoom keyframe, scene-relative. scale 1 = full page width; target = a `locate`/click name from the shot. */
export interface ZoomKey {
  t: number
  scale: number
  /** One element name, or several whose union should stay fully in frame. */
  target?: string | string[]
  /** Allow the zoom to crop the target's sides (otherwise the scale is clamped so the whole target fits). */
  allowCrop?: boolean
  /** Normalized center [x, y] in 0–1 when no target is given. */
  center?: [number, number]
}

export type Transition = 'fade' | 'smoothleft' | 'smoothright' | 'smoothup' | 'slideup' | 'zoomin' | 'circleopen' | 'fadeblack' | 'wipeleft' | 'none'

export interface SceneConfig {
  id: string
  duration: number
  source: { type: 'image'; screenshot: string } | { type: 'video'; shot: string; from: number }
  zoom?: ZoomKey[]
  blur?: number
  dim?: number
  card?: SceneCard
  badge?: { text: string; at: number; seconds?: number }
  /** Dim everything except a real located element (scene-relative seconds). */
  spotlight?: { target: string | string[]; at: number; until: number }[]
  captionPosition?: 'top' | 'bottom'
  /** Transition into the next scene. */
  transition?: Transition
}

export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  fontWeight: number
  textColor: string
  highlightColor: string
  boxColor: string
  boxOpacity: number
  maxCharsPerLine: number
  maxLines: number
  /** Caption box bottom edge (bottom position) and top edge (top position), in output px. */
  bottomY: number
  topY: number
  centerX: number
  maxWidth: number
  minCueSeconds: number
  maxCharsPerSecond: number
}

export type VoiceProvider = 'elevenlabs' | 'google' | 'azure' | 'say'

export interface VoiceConfig {
  /** auto = first configured of elevenlabs → google → azure. `say` (macOS) is a draft voice only. */
  provider: 'auto' | VoiceProvider
  language: string
  elevenlabs: { voiceId: string | null; model: string; stability: number; similarityBoost: number; style: number; speed: number }
  google: { voice: string; speakingRate: number }
  azure: { voice: string; rate: string }
  say: { voice: string; rate: number }
  /** Max speed-up applied if narration does not fit. */
  maxTempo: number
}

export interface MusicConfig {
  /** generated = original synthesized ambient bed (royalty-free by construction); file = a licensed track; none. */
  source: 'generated' | 'file' | 'none'
  file?: string | null
  license?: string | null
  /** Music level relative to normalized narration, in dB (negative). */
  gainDb: number
  bpm?: number
}

export interface VideoConfig {
  id: string
  title: string
  destination: string
  language: string
  site: { baseUrl: string; locale: string; langStorageKey: string; langValue: string; blockRequestPatterns: string[] }
  video: { width: number; height: number; fps: number; duration: number; transitionSeconds: number; crf: number; audioBitrate: string; loudnessLufs: number }
  capture: {
    viewport: { width: number; height: number }
    deviceScaleFactor: number
    navigationTimeoutMs: number
    stepTimeoutMs: number
    retries: number
    shots: ShotConfig[]
  }
  voice: VoiceConfig
  narration: NarrationLine[]
  subtitles: SubtitleStyle
  scenes: SceneConfig[]
  cta: { title: string; url: string; button: string; tagline?: string }
  music: MusicConfig
  output: { video: string; srt: string; script: string; contactSheet: string; report: string; timeline: string }
}

export interface Brand {
  primary: string
  primaryHover: string
  ink: string
  canvas: string
  wordmark: string
  source: 'website' | 'fallback'
}

/** Element rectangle in capture-master pixels (viewport CSS px × deviceScaleFactor), at shot time t. */
export interface Located { name: string; t: number; x: number; y: number; w: number; h: number; control: boolean }

export interface ShotResult {
  id: string
  url?: string
  finalUrl?: string
  status: 'ok' | 'skipped' | 'failed'
  reason?: string
  video?: string
  duration?: number
  frames?: number
  width?: number
  height?: number
  attempts: number
  log: { t: number; action: string; ok: boolean; note?: string }[]
  located: Located[]
}

export interface CaptureManifest {
  videoId: string
  capturedAt: string
  baseUrl: string
  brand: Brand
  logo?: string
  tagline?: string
  master: { width: number; height: number }
  shots: Record<string, ShotResult>
  screenshots: Record<string, string>
}

export const configPath = () =>
  process.env.VIDEO_CONFIG ? resolve(STUDIO_ROOT, process.env.VIDEO_CONFIG) : join(CONFIG_DIR, 'short-01-v2.json')

export function loadConfig(): VideoConfig {
  return JSON.parse(readFileSync(configPath(), 'utf8')) as VideoConfig
}

export const out = (rel: string) => join(DATA_ROOT, rel)

/** A licensed music file: `assets/...` ships with the studio, anything else lives in the data folder. */
export const musicPath = (rel: string) => (rel.startsWith('assets/') ? join(STUDIO_ROOT, rel) : out(rel))

export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function writeJson(file: string, data: unknown) {
  ensureDir(dirname(file))
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

export function log(scope: string, msg: string) {
  console.log(`[${scope}] ${msg}`)
}

/** Run a command, streaming nothing; throws with stderr tail on failure. */
export async function run(cmd: string, args: string[], opts: { timeoutMs?: number } = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += d })
    child.stderr.on('data', d => { stderr += d })
    const timer = opts.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs) : undefined
    child.on('error', reject)
    child.on('close', code => {
      if (timer) clearTimeout(timer)
      if (code === 0) resolvePromise({ stdout, stderr })
      else reject(new Error(`${cmd} exited ${code}\n${stderr.split('\n').slice(-25).join('\n')}`))
    })
  })
}

export async function ffmpeg(args: string[], timeoutMs = 10 * 60_000) {
  return run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeoutMs })
}

export interface ProbeStream {
  codec_type: string
  codec_name: string
  width?: number
  height?: number
  pix_fmt?: string
  r_frame_rate?: string
  avg_frame_rate?: string
  sample_rate?: string
  channels?: number
  duration?: string
  nb_frames?: string
}

export async function ffprobe(file: string): Promise<{ streams: ProbeStream[]; format: { duration?: string; format_name: string; size?: string } }> {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file])
  return JSON.parse(stdout)
}

export async function mediaDuration(file: string): Promise<number> {
  const info = await ffprobe(file)
  return Number(info.format.duration ?? 0)
}

export async function retry<T>(label: string, attempts: number, fn: (attempt: number) => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i)
    } catch (err) {
      lastErr = err
      log(label, `attempt ${i}/${attempts} failed: ${(err as Error).message.split('\n')[0]}`)
      if (i < attempts) await new Promise(r => setTimeout(r, 1500 * i))
    }
  }
  throw lastErr
}

export async function requireBinaries(names: string[]) {
  const missing: string[] = []
  for (const name of names) {
    try {
      await execFileAsync(name, ['-version'])
    } catch {
      missing.push(name)
    }
  }
  if (missing.length) throw new Error(`Missing required binaries: ${missing.join(', ')}. Install FFmpeg (brew install ffmpeg).`)
}

/** Load KEY=VALUE pairs from a local studio .env (CLI use) without overriding the real environment. */
export function loadDotEnv() {
  const file = join(STUDIO_ROOT, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || process.env[m[1]] !== undefined) continue
    const value = m[2].replace(/^["']|["']$/g, '').trim()
    if (value) process.env[m[1]] = value // empty entries in .env mean "not set"
  }
}

export const sec = (n: number) => n.toFixed(3)

export async function contactSheet(video: string, outFile: string) {
  // 24 frames, one every 2.5s, 6x4 grid.
  await ffmpeg(['-i', video, '-vf', 'fps=1/2.5,scale=270:480:flags=lanczos,tile=6x4:padding=8:margin=8:color=white',
    '-frames:v', '1', '-q:v', '3', outFile])
}

/** Deliverable paths; a render with a draft (non-production) voice gets a -DRAFT suffix so it can never pass as final. */
export function outputPaths(cfg: VideoConfig, draft: boolean) {
  const tag = (p: string) => (draft ? p.replace(/(\.[a-z0-9]+)$/i, '-DRAFT$1') : p)
  const o = cfg.output
  return {
    video: out(tag(o.video)), srt: out(tag(o.srt)), script: out(tag(o.script)), contactSheet: out(tag(o.contactSheet)),
    report: out(tag(o.report)), timeline: out(tag(o.timeline)),
  }
}
