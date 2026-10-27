// Stage 4 — validation. Verifies the rendered Short and writes a technical report (Markdown + JSON).
// Exits non-zero on any failure, including missing, silent or draft-only narration.
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  DATA_ROOT, contactSheet, dirs, ffprobe, loadConfig, outputPaths, readJson, run, writeJson,
  type CaptureManifest, type VideoConfig,
} from './lib.ts'
import { parseSrt, plainCaption } from './subtitles.ts'
import type { Timeline } from './timeline.ts'
import { SETUP_HELP, loadVoice, type VoiceManifest } from './voice.ts'

type Level = 'error' | 'warn'
interface Check { group: string; name: string; ok: boolean; detail: string; level: Level }
const checks: Check[] = []
let group = 'general'
const check = (name: string, ok: boolean, detail: string, level: Level = 'error') => checks.push({ group, name, ok, detail, level })

function topLevelBoxes(file: string): string[] {
  const fd = openSync(file, 'r')
  const boxes: string[] = []
  try {
    const size = statSync(file).size
    const header = Buffer.alloc(16)
    let pos = 0
    while (pos < size && boxes.length < 50) {
      readSync(fd, header, 0, 16, pos)
      let len = header.readUInt32BE(0)
      if (len === 1) len = Number(header.readBigUInt64BE(8))
      else if (len === 0) len = size - pos
      boxes.push(header.toString('latin1', 4, 8))
      if (len < 8) break
      pos += len
    }
  } finally {
    closeSync(fd)
  }
  return boxes
}

async function ff(args: string[]) {
  try {
    return (await run('ffmpeg', ['-hide_banner', '-nostats', ...args], { timeoutMs: 10 * 60_000 })).stderr
  } catch (err) {
    return `FAILED: ${(err as Error).message}`
  }
}

async function meanVolume(file: string, start?: number, dur?: number) {
  const range = start !== undefined ? ['-ss', start.toFixed(3), '-t', dur!.toFixed(3)] : []
  const s = await ff([...range, '-i', file, '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'])
  const num = (re: RegExp) => {
    const m = s.match(re)?.[1]
    return m === undefined || m === '-inf' ? -91 : Number(m)
  }
  return { mean: num(/mean_volume: (-?[\d.]+|-inf) dB/), max: num(/max_volume: (-?[\d.]+|-inf) dB/) }
}

/** WCAG contrast ratio. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16)
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Box colour composited over the worst case (white page) at its opacity. */
function blendOverWhite(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * alpha + 255 * (1 - alpha)))
  return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('')
}

async function main() {
  const cfg = loadConfig()
  group = 'narration'
  let voice: VoiceManifest | undefined
  try {
    voice = loadVoice(cfg)
    check('voice:present', true, `${voice.provider} — ${voice.voice}, ${voice.clips.length} clips`)
    check('voice:production', voice.production, voice.production ? 'production TTS provider' : `${voice.provider} is a draft voice (not publishable)`)
    check('voice:timing', true, `${voice.clips.filter(c => c.timing === 'provider').length}/${voice.clips.length} clips with provider word timings`,
      'warn')
    if (voice.clips.some(c => c.timing !== 'provider')) checks[checks.length - 1].ok = false
  } catch (err) {
    check('voice:present', false, (err as Error).message.split('\n')[0])
    console.error(`\n${SETUP_HELP}\n`)
    return finish(cfg, outputPaths(cfg, false).report)
  }
  const paths = outputPaths(cfg, !voice.production)
  group = 'files'
  for (const [k, f] of Object.entries(paths)) if (k !== 'report') check(`file:${k}`, existsSync(f), relative(DATA_ROOT, f))
  if (!existsSync(paths.video) || !existsSync(paths.timeline)) return finish(cfg, paths.report)
  const tl = readJson<Timeline & { controlOverlaps: { caption: number; control: string; scene: string; t: number }[]; graphics: { captions: { x: number; y: number; w: number; h: number; fontSize: number }[] } }>(paths.timeline)
  const V = cfg.video
  const video = paths.video

  // ---- container / stream format
  group = 'format'
  const info = await ffprobe(video)
  const v = info.streams.find(s => s.codec_type === 'video')
  const a = info.streams.find(s => s.codec_type === 'audio')
  const duration = Number(info.format.duration)
  check('container', /mp4/.test(info.format.format_name), info.format.format_name)
  check('video:codec', v?.codec_name === 'h264', `${v?.codec_name}`)
  check('video:resolution', v?.width === V.width && v?.height === V.height, `${v?.width}x${v?.height}`)
  check('video:pix_fmt', v?.pix_fmt === 'yuv420p', `${v?.pix_fmt}`)
  check('video:fps', v?.r_frame_rate === `${V.fps}/1` && v?.avg_frame_rate === `${V.fps}/1`, `${v?.r_frame_rate} (avg ${v?.avg_frame_rate})`)
  check('duration', duration >= 58 && duration <= 62, `${duration.toFixed(3)}s (58–62)`)
  check('audio:codec', a?.codec_name === 'aac', a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch` : 'no audio stream')
  check('audio:duration', a ? Math.abs(Number(a.duration) - duration) < 0.2 : false, `${Number(a?.duration ?? 0).toFixed(3)}s`)
  const boxes = topLevelBoxes(video)
  check('faststart', boxes.indexOf('moov') > -1 && boxes.indexOf('moov') < boxes.indexOf('mdat'), boxes.join(' > '))

  // ---- frames
  group = 'frames'
  const { stdout: pts } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', video])
  const times = pts.trim().split('\n').map(l => parseFloat(l)).filter(n => !Number.isNaN(n))
  const expected = Math.round(V.duration * V.fps)
  const gaps = times.slice(1).map((t, i) => t - times[i]).filter(d => Math.abs(d - 1 / V.fps) > 0.004)
  check('frames:count', times.length === expected, `${times.length} decoded frames (expected ${expected})`)
  check('frames:continuous', gaps.length === 0 && Math.abs(times[0]) < 0.001, gaps.length ? `${gaps.length} irregular frame intervals` : 'every frame 1/30 s apart, starts at 0')
  const decodeV = await ff(['-v', 'error', '-i', video, '-map', '0:v', '-f', 'null', '-'])
  check('frames:decode', decodeV.trim() === '', decodeV.trim() || 'decodes without errors')
  const black = await ff(['-i', video, '-vf', 'blackdetect=d=0.2:pix_th=0.10', '-an', '-f', 'null', '-'])
  const blacks = [...black.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map(m => `${m[1]}–${m[2]}s`)
  check('frames:no-black', !black.startsWith('FAILED') && !blacks.length, blacks.join(', ') || 'none')
  const freeze = await ff(['-i', video, '-vf', 'freezedetect=n=0.001:d=2.5', '-an', '-f', 'null', '-'])
  const freezes = [...freeze.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)].map(m => `${Number(m[1]).toFixed(1)}s (+${Number(m[2]).toFixed(1)}s)`)
  check('frames:no-long-freeze', !freezes.length, freezes.join(', ') || 'no still stretch ≥ 2.5 s', 'warn')

  // ---- audio
  group = 'audio'
  const decodeA = await ff(['-v', 'error', '-i', video, '-map', '0:a', '-f', 'null', '-'])
  check('audio:decode', decodeA.trim() === '', decodeA.trim() || 'decodes without errors')
  const whole = await meanVolume(video)
  check('audio:not-silent', whole.max > -30 && whole.mean > -40, `mean ${whole.mean} dB, max ${whole.max} dB`)
  const r128 = await ff(['-i', video, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  const I = Number(r128.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop()?.match(/-?[\d.]+/)?.[0] ?? -70)
  const TP = Number(r128.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop()?.match(/-?[\d.]+/)?.[0] ?? 0)
  check('audio:loudness', I >= V.loudnessLufs - 2.5 && I <= V.loudnessLufs + 1.5, `${I} LUFS integrated (target ${V.loudnessLufs})`)
  check('audio:true-peak', TP <= -0.5, `${TP} dBTP`)
  // Narration must be clearly audible in every line, and clearly above the music between lines.
  const lineLevels: number[] = []
  for (const n of tl.narration) {
    const lv = await meanVolume(video, n.start + 0.05, Math.max(0.3, n.end - n.start - 0.1))
    lineLevels.push(lv.mean)
    check(`narration:${n.id}`, lv.mean > -30, `${n.start.toFixed(2)}–${n.end.toFixed(2)}s mean ${lv.mean} dB`)
  }
  const gapsBetween = tl.narration.slice(1).map((n, i) => ({ s: tl.narration[i].end + 0.15, e: n.start - 0.1 })).filter(g => g.e - g.s > 0.5)
  if (gapsBetween.length && tl.music.source !== 'none') {
    const bed: number[] = []
    for (const g of gapsBetween) bed.push((await meanVolume(video, g.s, g.e - g.s)).mean)
    const bedMean = Math.max(...bed)
    const speechMin = Math.min(...lineLevels)
    check('mix:narration-above-music', speechMin - bedMean >= 8, `quietest line ${speechMin} dB vs loudest music-only gap ${bedMean} dB (≥ 8 dB apart)`)
  }

  // ---- subtitles
  group = 'subtitles'
  const raw = readFileSync(paths.srt, 'utf8')
  const subs = parseSrt(raw)
  const S = cfg.subtitles
  check('srt:cues', subs.length > 0 && subs.length === tl.captions.length, `${subs.length} cues (timeline ${tl.captions.length})`)
  check('srt:utf8-nfc', raw === raw.normalize('NFC'), 'UTF-8, NFC')
  if (cfg.language.startsWith('vi')) {
    check('srt:diacritics', /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(raw), 'Vietnamese diacritics present')
  } else {
    check('srt:script', !/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(raw), `no Vietnamese text in a ${cfg.language} subtitle file`)
  }
  check('srt:ordered', subs.every((s, i) => s.index === i + 1 && s.start < s.end && (i === 0 || s.start >= subs[i - 1].end - 1e-3)), 'sequential, non-overlapping')
  check('srt:in-range', subs.every(s => s.end <= duration + 0.01), `last cue ends ${subs[subs.length - 1]?.end}s`)
  const srtText = subs.flatMap(s => s.lines).join(' ').replace(/\s+/g, ' ')
  const missing = tl.narration.filter(n => !srtText.includes(plainCaption(n.caption)))
  check('srt:covers-narration', !missing.length, missing.length ? `missing ${missing.map(m => m.id).join(', ')}` : 'every narration line captioned verbatim')
  const late = tl.narration.filter(n => !subs.some(s => Math.abs(s.start - n.start) < 0.08))
  check('sync:cue-starts', !late.length, late.length ? `no cue at start of ${late.map(l => l.id).join(', ')}` : 'a cue starts with every narration line (±80 ms)')
  const timedBy = tl.narration.every(n => n.timing === 'provider') ? 'provider word timings' : 'estimated word timings'
  check('sync:source', tl.narration.every(n => n.timing === 'provider'), `cue boundaries from ${timedBy}`, 'warn')
  const short = subs.filter(s => s.end - s.start < S.minCueSeconds)
  check('read:cue-duration', !short.length, short.length ? `cues ${short.map(s => s.index).join(', ')} under ${S.minCueSeconds}s` : `every cue ≥ ${S.minCueSeconds}s`)
  const fast = subs.map(s => ({ i: s.index, cps: s.lines.join(' ').length / (s.end - s.start) })).filter(c => c.cps > S.maxCharsPerSecond)
  check('read:speed', !fast.length, fast.length ? fast.map(f => `#${f.i} ${f.cps.toFixed(1)} cps`).join(', ') : `≤ ${S.maxCharsPerSecond} chars/s`)
  const longLine = Math.max(...subs.flatMap(s => s.lines.map(l => l.length)))
  check('read:lines', subs.every(s => s.lines.length <= S.maxLines) && longLine <= S.maxCharsPerLine, `≤ ${S.maxLines} lines, longest ${longLine} chars`)
  const minFont = Math.min(...tl.graphics.captions.map(c => c.fontSize))
  check('read:font-size', minFont >= 48, `smallest caption ${minFont}px on a ${V.width}px-wide frame`)
  const ratio = contrast(S.textColor, blendOverWhite(S.boxColor, S.boxOpacity))
  check('read:contrast', ratio >= 7, `${ratio.toFixed(1)}:1 text vs caption box (worst case over white)`)
  const unsafe = tl.graphics.captions.filter(c => c.y < 250 || c.y + c.h > 1560 || c.x < 40 || c.x + c.w > V.width - 40)
  check('read:safe-area', !unsafe.length, unsafe.length ? `${unsafe.length} captions outside the Shorts safe area` : 'all captions inside y 250–1560, x 40–1040')
  check('read:controls-clear', !tl.controlOverlaps.length,
    tl.controlOverlaps.length ? tl.controlOverlaps.map(o => `cue ${o.caption} covers "${o.control}" (${o.scene} @${o.t}s)`).join('; ') : 'no caption covers a clicked or marked control')

  // ---- website footage
  group = 'footage'
  const manifest = readJson<CaptureManifest>(join(dirs(cfg).capture, 'manifest.json'))
  const host = new URL(cfg.site.baseUrl).host
  const used = [...new Set(tl.scenes.flatMap(s => (s.source.type === 'video' ? [s.source.shot] : [])))]
  for (const id of used) {
    const shot = manifest.shots[id]
    const okHost = !!shot?.finalUrl && new URL(shot.finalUrl).host === host
    const failedSteps = shot?.log.filter(l => !l.ok) ?? []
    check(`footage:${id}`, shot?.status === 'ok' && okHost && !failedSteps.length,
      `${shot?.finalUrl ?? 'missing'}${failedSteps.length ? `; skipped steps: ${failedSteps.map(f => f.action).join(', ')}` : ''}`)
  }
  check('footage:seconds', tl.websiteFootageSeconds >= 30, `${tl.websiteFootageSeconds}s of real site recording (≥ 30)`)
  const ageDays = (Date.now() - Date.parse(manifest.capturedAt)) / 86_400_000
  check('footage:fresh', ageDays <= 14, `captured ${manifest.capturedAt} (${ageDays.toFixed(1)} days ago)`, 'warn')
  check('footage:resolution', manifest.master.width >= V.width && manifest.master.height >= V.height, `captured at ${manifest.master.width}x${manifest.master.height} (no upscaling)`)
  for (const s of tl.skippedFeatures) check(`footage:skipped:${s.id}`, false, s.reason, 'warn')

  // ---- story
  group = 'story'
  const hook = tl.scenes[0]
  check('story:hook', hook.start === 0 && hook.end <= 3.01 && !!hook.card, `${hook.id} 0–${hook.end}s with on-screen hook`)
  const cta = tl.scenes[tl.scenes.length - 1]
  check('story:cta', cta.card?.kind === 'cta' && cta.end - cta.start >= 5, `${cta.id} ${cta.start}–${cta.end}s`)
  for (const w of tl.warnings) check('timeline:warning', false, w, 'warn')

  // Readable footage must never be zoomed past the page's side padding (that cuts words off).
  group = 'framing'
  const SAFE = 1.07
  const cropped = tl.scenes.filter(s => (s.blur ?? 0) < 12 && s.zoom.some(z => z.scale > SAFE + 1e-6)
    && !(cfg.scenes.find(c => c.id === s.id)?.zoom ?? []).some(z => z.allowCrop))
  check('framing:no-cropped-text', !cropped.length,
    cropped.length ? cropped.map(s => `${s.id} zooms to ${Math.max(...s.zoom.map(z => z.scale)).toFixed(2)}x`).join('; ') : `every readable scene ≤ ${SAFE}x (blurred backgrounds excepted)`)
  const allowed = cfg.scenes.filter(s => s.zoom?.some(z => z.allowCrop)).map(s => s.id)
  check('framing:crop-opt-ins', !allowed.length, allowed.length ? `allowCrop in ${allowed.join(', ')}` : 'no scene opts into cropping', 'warn')

  group = 'review'
  if (!existsSync(paths.contactSheet)) await contactSheet(video, paths.contactSheet)
  const sheet = await ffprobe(paths.contactSheet).catch(() => undefined)
  check('contact-sheet', !!sheet?.streams[0]?.width, sheet ? `${relative(DATA_ROOT, paths.contactSheet)} ${sheet.streams[0].width}x${sheet.streams[0].height}` : 'missing')

  return finish(cfg, paths.report, { video: relative(DATA_ROOT, video), size: Number(info.format.size), duration, I, TP, voice })
}

function finish(cfg: VideoConfig, reportFile: string, meta?: Record<string, unknown>) {
  const errors = checks.filter(c => !c.ok && c.level === 'error')
  const warns = checks.filter(c => !c.ok && c.level === 'warn')
  const status = errors.length ? 'FAILED' : 'PASSED'
  for (const c of checks) console.log(`${c.ok ? 'PASS' : c.level === 'warn' ? 'WARN' : 'FAIL'}  ${c.name.padEnd(28)} ${c.detail}`)
  console.log(`\n${status}: ${checks.length - errors.length - warns.length} passed, ${warns.length} warnings, ${errors.length} failed`)
  const md = [
    `# Validation report — ${cfg.id}`,
    '',
    `**${status}** · ${new Date().toISOString()} · ${checks.length - errors.length - warns.length} passed, ${warns.length} warnings, ${errors.length} failed`,
    '',
    ...(meta ? [`- File: \`${meta.video}\` (${((meta.size as number) / 1e6).toFixed(1)} MB, ${(meta.duration as number).toFixed(3)} s)`,
      `- Voice: ${(meta.voice as VoiceManifest).provider} — ${(meta.voice as VoiceManifest).voice}${(meta.voice as VoiceManifest).production ? '' : ' (**draft**)'}`,
      `- Loudness: ${meta.I} LUFS integrated, ${meta.TP} dBTP true peak`, ''] : []),
    ...(errors.length ? ['## Failures', '', ...errors.map(c => `- **${c.name}** — ${c.detail}`), ''] : []),
    ...(warns.length ? ['## Warnings', '', ...warns.map(c => `- ${c.name} — ${c.detail}`), ''] : []),
    '## All checks', '',
    '| Group | Check | Result | Detail |', '| --- | --- | --- | --- |',
    ...checks.map(c => `| ${c.group} | ${c.name} | ${c.ok ? 'PASS' : c.level === 'warn' ? 'WARN' : 'FAIL'} | ${c.detail.replace(/\|/g, '\\|')} |`),
    '',
  ].join('\n')
  writeJson(reportFile.replace(/\.md$/, '.json'), { status, checks })
  writeFileSync(reportFile, md, 'utf8')
  console.log(`report: ${relative(DATA_ROOT, reportFile)}`)
  if (errors.length) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
