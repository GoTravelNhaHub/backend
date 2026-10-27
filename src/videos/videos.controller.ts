import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { AdminOnly, CurrentUser } from '../common/auth/decorators'
import { createError } from '../common/http-error'
import { zodBodySchema } from '../common/openapi'
import type { AuthUser } from '../auth/session'
import { StartJobSchema } from './dto/start-job.dto'
import { VideoJobsService } from './video-jobs.service'
import { VideosService } from './videos.service'

/**
 * Video studio: YouTube Shorts rendered from real footage of www.gotravelnha.com
 * (Playwright capture → TTS narration → FFmpeg render → validation). Admin only.
 */
@ApiTags('admin: videos')
@AdminOnly()
@Controller('api/admin/videos')
export class VideosController {
  constructor(
    private readonly videos: VideosService,
    private readonly jobs: VideoJobsService
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether this host can render: FFmpeg, Chromium, TTS credentials, running job' })
  async status() {
    return { success: true, data: await this.videos.status() }
  }

  @Get('configs')
  @ApiOperation({ summary: 'Video configs with their latest final and draft renders' })
  configs() {
    return { success: true, data: this.videos.listConfigs() }
  }

  @Get('configs/:name')
  @ApiOperation({ summary: 'One video config (JSON)' })
  @ApiParam({ name: 'name', description: 'File name without .json' })
  config(@Param('name') name: string) {
    return { success: true, data: this.videos.getConfig(name) }
  }

  @Put('configs/:name')
  @ApiOperation({ summary: 'Create or replace a video config', description: 'A new video is a new config. See src/videos/studio/README.md for the format.' })
  @ApiParam({ name: 'name', description: 'Lowercase letters, digits and dashes' })
  @ApiBody({ schema: { type: 'object', description: 'Video config (id, site, video, capture, voice, narration, subtitles, scenes, cta, music, output)' } })
  saveConfig(@Param('name') name: string, @Body() body: unknown) {
    return { success: true, data: this.videos.saveConfig(name, body) }
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Recent render jobs (newest first, without logs)' })
  listJobs() {
    return { success: true, data: this.jobs.list().map(({ log, ...job }) => job) }
  }

  @Post('jobs')
  @HttpCode(202)
  @ApiOperation({ summary: 'Start a render job', description: 'One job at a time; 409 while another runs. Not available on serverless hosts (503).' })
  @ApiBody({ schema: zodBodySchema(StartJobSchema) })
  startJob(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    const parsed = StartJobSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Choose a config and at least one stage.' })
    const { log, ...job } = this.jobs.start({ ...parsed.data, startedBy: user.email })
    return { success: true, data: job }
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'One job with its log' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'tail', required: false, description: 'Only the last N log lines (default 400)' })
  job(@Param('id') id: string, @Query('tail') tail?: string) {
    const job = this.jobs.get(id)
    if (!job) throw createError({ statusCode: 404, message: 'Job not found.' })
    const n = Math.min(Math.max(Number(tail) || 400, 1), 2000)
    return { success: true, data: { ...job, log: job.log.slice(-n) } }
  }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel the running job' })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancel(@Param('id') id: string) {
    const { log, ...job } = this.jobs.cancel(id)
    return { success: true, data: job }
  }

  @Get('file')
  @ApiOperation({ summary: 'Stream a deliverable (MP4, SRT, script, contact sheet, report)', description: 'Supports Range requests, so the admin player can seek.' })
  @ApiQuery({ name: 'path', description: 'Path under output/, as listed by GET configs' })
  @ApiQuery({ name: 'download', required: false, description: '1 to download instead of display' })
  @ApiProduces('video/mp4', 'image/jpeg', 'text/plain', 'text/markdown', 'application/json')
  file(@Query('path') path: string, @Query('download') download: string | undefined, @Res() res: Response) {
    const full = this.videos.resolveOutputFile(path)
    if (download === '1') return res.download(full)
    res.setHeader('cache-control', 'private, max-age=60')
    return res.sendFile(full)
  }
}
