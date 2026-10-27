import { Injectable } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { createError } from '../common/http-error'
import { CONFIG_DIR, CONFIG_NAME, DATA_DIR, OUTPUT_DIR, configFile, dataPath } from './videos.paths'
import { VideoJobsService } from './video-jobs.service'

const execFileAsync = promisify(execFile)

type Deliverable = 'video' | 'srt' | 'script' | 'contactSheet' | 'report' | 'timeline'
const DELIVERABLES: Deliverable[] = ['video', 'srt', 'script', 'contactSheet', 'report', 'timeline']

interface VideoConfigFile {
  id?: string
  title?: string
  destination?: string
  language?: string
  video?: { duration?: number; width?: number; height?: number }
  output?: Partial<Record<Deliverable, string>>
  [key: string]: unknown
}

const draftOf = (p: string) => p.replace(/(\.[a-z0-9]+)$/i, '-DRAFT$1')

@Injectable()
export class VideosService {
  constructor(private readonly jobs: VideoJobsService) {}

  /** What the host can do: binaries, browser, TTS credentials, and whether a render is running. */
  async status() {
    const binary = async (name: string) => {
      try {
        const { stdout } = await execFileAsync(name, ['-version'], { timeout: 5000 })
        return { ok: true, version: stdout.split('\n')[0].slice(0, 120) }
      } catch {
        return { ok: false, version: null }
      }
    }
    let chromium = false
    try {
      const { chromium: browser } = await import('playwright')
      chromium = existsSync(browser.executablePath())
    } catch {
      chromium = false
    }
    const env = process.env
    const tts = {
      elevenlabs: Boolean(env.ELEVENLABS_API_KEY),
      google: Boolean(env.GOOGLE_TTS_API_KEY || env.GOOGLE_TTS_ACCESS_TOKEN),
      azure: Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION),
      forced: env.TTS_PROVIDER || null
    }
    const [ffmpeg, ffprobe] = await Promise.all([binary('ffmpeg'), binary('ffprobe')])
    const serverless = Boolean(env.VERCEL)
    return {
      canRender: !serverless && ffmpeg.ok && ffprobe.ok && chromium && (tts.elevenlabs || tts.google || tts.azure),
      serverless,
      ffmpeg,
      ffprobe,
      chromium,
      tts,
      dataDir: DATA_DIR,
      running: this.jobs.running ? { id: this.jobs.running.id, config: this.jobs.running.config, stage: this.jobs.running.stage } : null
    }
  }

  listConfigs() {
    if (!existsSync(CONFIG_DIR)) return []
    return readdirSync(CONFIG_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((file) => {
        const name = file.slice(0, -5)
        const full = configFile(name)
        let cfg: VideoConfigFile = {}
        let error: string | null = null
        try {
          cfg = JSON.parse(readFileSync(full, 'utf8'))
        } catch (e) {
          error = `Invalid JSON: ${(e as Error).message}`
        }
        return {
          name,
          id: cfg.id ?? null,
          title: cfg.title ?? null,
          destination: cfg.destination ?? null,
          language: cfg.language ?? null,
          durationSeconds: cfg.video?.duration ?? null,
          updatedAt: statSync(full).mtime.toISOString(),
          error,
          render: error ? null : this.renderFor(name, cfg)
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getConfig(name: string): VideoConfigFile {
    this.assertName(name)
    if (!existsSync(configFile(name))) throw createError({ statusCode: 404, message: `No video config named "${name}".` })
    try {
      return JSON.parse(readFileSync(configFile(name), 'utf8'))
    } catch (e) {
      throw createError({ statusCode: 422, message: `Config is not valid JSON: ${(e as Error).message}` })
    }
  }

  /** Saves a config. Checks the shape the pipeline needs; the stages themselves validate the details. */
  saveConfig(name: string, body: unknown) {
    this.assertName(name)
    if (this.jobs.running?.config === name) {
      throw createError({ statusCode: 409, message: 'This config is being rendered right now. Save it after the job finishes.' })
    }
    const cfg = body as VideoConfigFile
    const problems: string[] = []
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) problems.push('the config must be a JSON object')
    else {
      if (typeof cfg.id !== 'string' || !cfg.id) problems.push('"id" is required')
      for (const key of ['site', 'video', 'capture', 'voice', 'subtitles', 'cta', 'music', 'output']) {
        if (!cfg[key] || typeof cfg[key] !== 'object') problems.push(`"${key}" must be an object`)
      }
      for (const key of ['narration', 'scenes']) if (!Array.isArray(cfg[key])) problems.push(`"${key}" must be an array`)
      for (const d of DELIVERABLES) {
        const p = cfg.output?.[d]
        if (typeof p !== 'string' || !p.startsWith('output/') || !dataPath(p)) problems.push(`"output.${d}" must be a path under output/`)
      }
    }
    if (problems.length) throw createError({ statusCode: 400, message: `Config not saved: ${problems.join('; ')}.` })
    writeFileSync(configFile(name), `${JSON.stringify(cfg, null, 2)}\n`)
    return this.listConfigs().find((c) => c.name === name)
  }

  /** Final and draft deliverables of one config, with sizes and the validation result. */
  private renderFor(name: string, cfg: VideoConfigFile) {
    const variant = (draft: boolean) => {
      const files: Record<string, { path: string; size: number; updatedAt: string } | null> = {}
      for (const d of DELIVERABLES) {
        const rel = cfg.output?.[d]
        const path = rel ? (draft ? draftOf(rel) : rel) : null
        const full = path ? dataPath(path) : null
        files[d] = full && existsSync(full) ? { path: path!, size: statSync(full).size, updatedAt: statSync(full).mtime.toISOString() } : null
      }
      if (!files.video) return null
      let validation: { status: string; failed: string[]; warnings: string[] } | null = null
      const reportJson = files.report ? dataPath(files.report.path.replace(/\.md$/, '.json')) : null
      if (reportJson && existsSync(reportJson)) {
        try {
          const report = JSON.parse(readFileSync(reportJson, 'utf8')) as { status: string; checks: Array<{ name: string; ok: boolean; level: string; detail?: string }> }
          validation = {
            status: report.status,
            failed: report.checks.filter((c) => !c.ok && c.level === 'error').map((c) => `${c.name}${c.detail ? `: ${c.detail}` : ''}`),
            warnings: report.checks.filter((c) => !c.ok && c.level !== 'error').map((c) => `${c.name}${c.detail ? `: ${c.detail}` : ''}`)
          }
        } catch {
          validation = null
        }
      }
      return { files, validation }
    }
    return { final: variant(false), draft: variant(true) }
  }

  /** Absolute path of a deliverable under output/, for streaming. */
  resolveOutputFile(rel: string) {
    const full = typeof rel === 'string' && rel.startsWith('output/') ? dataPath(rel) : null
    if (!full || !full.startsWith(OUTPUT_DIR) || !existsSync(full) || !statSync(full).isFile()) {
      throw createError({ statusCode: 404, message: 'File not found.' })
    }
    return full
  }

  private assertName(name: string) {
    if (!CONFIG_NAME.test(name)) {
      throw createError({ statusCode: 400, message: 'Config names use lowercase letters, digits and dashes (max 64).' })
    }
  }
}
