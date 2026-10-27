import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createError } from '../common/http-error'
import { CONFIG_DIR, DATA_DIR, JOBS_DIR, STUDIO_DIR, configFile, prepareDataDirs } from './videos.paths'

export const STAGES = ['capture', 'voice', 'render', 'validate'] as const
export type Stage = (typeof STAGES)[number]

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted'

export interface VideoJob {
  id: string
  config: string
  stages: Stage[]
  ttsProvider?: string
  captureOnly?: string[]
  status: JobStatus
  /** Stage running now, or the one that failed */
  stage: Stage | null
  completedStages: Stage[]
  error: string | null
  startedBy: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  /** Last lines of the pipeline output */
  log: string[]
}

const MAX_LOG_LINES = 2000
const MAX_JOBS_LISTED = 30
const tsxCli = () => require.resolve('tsx/cli')

/**
 * Runs the video pipeline one job at a time. Each stage is a child process (`tsx src/<stage>.ts` in the
 * studio folder) so Chromium or FFmpeg trouble cannot take the API down. Job records are JSON files in
 * <data>/jobs, so history survives restarts; a job that was running when the process stopped is marked
 * "interrupted".
 */
@Injectable()
export class VideoJobsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('VideoJobs')
  private current: { job: VideoJob; child: ChildProcess | null; cancelled: boolean } | null = null
  private lastSaved = 0

  onModuleInit() {
    try {
      prepareDataDirs()
      for (const job of this.list()) {
        if (job.status === 'running' || job.status === 'queued') {
          this.save({ ...job, status: 'interrupted', finishedAt: new Date().toISOString() })
        }
      }
    } catch (error) {
      // Read-only or serverless filesystems: the endpoints report it, the API keeps running
      this.logger.warn(`Video studio data folder unavailable: ${(error as Error).message}`)
    }
  }

  onApplicationShutdown() {
    this.current?.child?.kill('SIGTERM')
  }

  get running() {
    return this.current?.job ?? null
  }

  list(): VideoJob[] {
    if (!existsSync(JOBS_DIR)) return []
    return readdirSync(JOBS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => this.read(f.slice(0, -5)))
      .filter((j): j is VideoJob => !!j)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_JOBS_LISTED)
  }

  get(id: string): VideoJob | null {
    if (this.current?.job.id === id) return this.current.job
    return /^[0-9a-f-]{36}$/.test(id) ? this.read(id) : null
  }

  start(input: { config: string; stages: Stage[]; ttsProvider?: string; captureOnly?: string[]; startedBy: string | null }) {
    if (process.env.VERCEL) {
      throw createError({ statusCode: 503, message: 'Video rendering needs a long-running host with FFmpeg and Chromium; it cannot run on Vercel.' })
    }
    if (this.current) {
      throw createError({ statusCode: 409, message: `A render is already running (${this.current.job.config}). Wait for it or cancel it.` })
    }
    if (!existsSync(configFile(input.config))) {
      throw createError({ statusCode: 404, message: `No video config named "${input.config}".` })
    }
    const stages = STAGES.filter((s) => input.stages.includes(s))
    const job: VideoJob = {
      id: randomUUID(),
      config: input.config,
      stages,
      ttsProvider: input.ttsProvider,
      captureOnly: input.captureOnly,
      status: 'queued',
      stage: null,
      completedStages: [],
      error: null,
      startedBy: input.startedBy,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      log: []
    }
    this.current = { job, child: null, cancelled: false }
    this.save(job, true)
    void this.runJob()
    return job
  }

  cancel(id: string) {
    if (!this.current || this.current.job.id !== id) {
      throw createError({ statusCode: 409, message: 'That job is not running.' })
    }
    this.current.cancelled = true
    this.current.child?.kill('SIGTERM')
    return this.current.job
  }

  private async runJob() {
    const state = this.current!
    const job = state.job
    job.status = 'running'
    job.startedAt = new Date().toISOString()
    this.append(job, `▶ ${job.config}: ${job.stages.join(' → ')}`)

    try {
      for (const stage of job.stages) {
        if (state.cancelled) break
        job.stage = stage
        this.append(job, `── ${stage} ──`)
        this.save(job, true)
        const code = await this.runStage(job, stage)
        if (state.cancelled) break
        if (code !== 0) {
          job.status = 'failed'
          job.error =
            stage === 'validate'
              ? 'Validation failed. See the validation report for the failing checks.'
              : `The ${stage} stage exited with code ${code}. See the log for details.`
          break
        }
        job.completedStages.push(stage)
      }
      if (state.cancelled) {
        job.status = 'cancelled'
        job.error = 'Cancelled by an admin.'
      } else if (job.status === 'running') {
        job.status = 'succeeded'
        job.stage = null
      }
    } catch (error) {
      job.status = 'failed'
      job.error = (error as Error).message
    } finally {
      job.finishedAt = new Date().toISOString()
      this.append(job, `■ ${job.status}${job.error ? `: ${job.error}` : ''}`)
      this.save(job, true)
      this.current = null
    }
  }

  private runStage(job: VideoJob, stage: Stage) {
    return new Promise<number>((resolvePromise, reject) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        VIDEO_CONFIG: configFile(job.config),
        VIDEO_STUDIO_DATA_DIR: DATA_DIR,
        VIDEO_STUDIO_CONFIG_DIR: CONFIG_DIR,
        FORCE_COLOR: '0'
      }
      if (job.ttsProvider) env.TTS_PROVIDER = job.ttsProvider
      if (job.captureOnly?.length) env.CAPTURE_ONLY = job.captureOnly.join(',')

      const child = spawn(process.execPath, [tsxCli(), join('src', `${stage}.ts`)], { cwd: STUDIO_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] })
      this.current!.child = child
      const onData = (chunk: Buffer) => {
        for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) this.append(job, line)
      }
      child.stdout.on('data', onData)
      child.stderr.on('data', onData)
      child.on('error', reject)
      child.on('close', (code, signal) => {
        this.current!.child = null
        resolvePromise(code ?? (signal ? 1 : 0))
      })
    })
  }

  private append(job: VideoJob, line: string) {
    job.log.push(line.length > 2000 ? `${line.slice(0, 2000)}…` : line)
    if (job.log.length > MAX_LOG_LINES) job.log.splice(0, job.log.length - MAX_LOG_LINES)
    this.save(job)
  }

  /** Writes the job record; log-only updates are throttled to one write every 2 s. */
  private save(job: VideoJob, force = false) {
    const now = Date.now()
    if (!force && now - this.lastSaved < 2000) return
    this.lastSaved = now
    try {
      writeFileSync(join(JOBS_DIR, `${job.id}.json`), JSON.stringify(job, null, 2))
    } catch (error) {
      this.logger.warn(`Could not save job ${job.id}: ${(error as Error).message}`)
    }
  }

  private read(id: string): VideoJob | null {
    try {
      return JSON.parse(readFileSync(join(JOBS_DIR, `${id}.json`), 'utf8')) as VideoJob
    } catch {
      return null
    }
  }
}
