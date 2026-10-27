// Stage 3 — composition: timeline → graphics → per-scene segments → transitions → captions + mixed audio → MP4.
// Requires narration from `npm run video:voice`; it never renders a silent substitute.
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  DATA_ROOT, contactSheet, dirs, ensureDir, ffmpeg, ffprobe, loadConfig, log, mediaDuration, musicPath, out, outputPaths, readJson,
  requireBinaries, sec, writeJson, type CaptureManifest, type VideoConfig,
} from './lib.ts'
import { renderGraphics, type Graphics } from './graphics.ts'
import { generateMusic } from './music.ts'
import { plainCaption, writeSrt } from './subtitles.ts'
import { buildTimeline, toOutput, type ResolvedKey, type Timeline, type TimelineScene } from './timeline.ts'
import { loadVoice } from './voice.ts'

const rel = (p: string) => relative(DATA_ROOT, p)
const ISO639_2: Record<string, string> = { vi: 'vie', en: 'eng', zh: 'zho' }
const UPSCALE = 2 // zoompan works on a 2x source so sub-pixel motion stays smooth

/** Piecewise smoothstep expression over output frame number `on`. */
function keyExpr(keys: ResolvedKey[], pick: (k: ResolvedKey) => number, fps: number) {
  const f = keys.map(k => Math.round(k.t * fps))
  let expr = `${pick(keys[keys.length - 1])}`
  for (let i = keys.length - 2; i >= 0; i--) {
    const a = pick(keys[i])
    const b = pick(keys[i + 1])
    const df = Math.max(1, f[i + 1] - f[i])
    const u = `(clip((on-${f[i]})/${df},0,1))`
    const seg = a === b ? `${a}` : `(${a}+(${b - a})*${u}*${u}*(3-2*${u}))`
    expr = `if(lte(on,${f[i + 1]}),${seg},${expr})`
  }
  return expr
}

export interface ControlOverlap { caption: number; scene: string; control: string; t: number }

/** Captions must never cover a control the footage is pointing at (clicked or marked `control`). */
function findOverlaps(tl: Timeline, g: Graphics): ControlOverlap[] {
  const found: ControlOverlap[] = []
  const { width: W, height: H } = tl.video
  tl.captions.forEach((c, i) => {
    const cap = g.captions[i]
    for (const s of tl.scenes) {
      if (s.kind !== 'video' || c.end <= s.start || c.start >= s.end) continue
      const from = s.source.type === 'video' ? s.source.from : 0
      for (const l of s.located.filter(l => l.control)) {
        const tScene = l.t - from
        const tAbs = s.start + tScene
        if (tScene < -0.3 || tScene > s.end - s.start + 0.3 || tAbs < c.start - 0.5 || tAbs > c.end + 0.5) continue
        const r = toOutput(s, l, Math.max(0, tScene), W, H)
        const pad = 12
        const hit = r.x < cap.x + cap.w + pad && r.x + r.w > cap.x - pad && r.y < cap.y + cap.h + pad && r.y + r.h > cap.y - pad
        const onScreen = r.y + r.h > 0 && r.y < H
        if (hit && onScreen) found.push({ caption: c.index, scene: s.id, control: l.name, t: +tAbs.toFixed(2) })
      }
    }
  })
  return found
}

async function validateAssets(tl: Timeline) {
  const problems: string[] = []
  for (const s of tl.scenes) {
    try {
      const v = (await ffprobe(s.file)).streams.find(st => st.codec_type === 'video')
      if (!v) problems.push(`scene ${s.id}: no video stream in ${rel(s.file)}`)
      else if (v.width !== s.srcW || v.height !== s.srcH) problems.push(`scene ${s.id}: source is ${v.width}x${v.height}, expected ${s.srcW}x${s.srcH}`)
    } catch (err) {
      problems.push(`scene ${s.id}: unreadable ${rel(s.file)} (${(err as Error).message.split('\n')[0]})`)
    }
  }
  for (const n of tl.narration) if (!existsSync(n.file)) problems.push(`narration ${n.id}: missing ${rel(n.file)}`)
  if (tl.music.source === 'file') {
    if (!tl.music.file || !existsSync(musicPath(tl.music.file))) problems.push(`music file missing: ${tl.music.file}`)
    if (!tl.music.license) problems.push('music.source is "file" but music.license is empty; only use licensed music')
  }
  if (!tl.captions.length) problems.push('no captions generated')
  if (problems.length) throw new Error(`Asset validation failed:\n  - ${problems.join('\n  - ')}`)
  log('render', `assets validated: ${tl.scenes.length} scenes, ${tl.narration.length} voice clips, ${tl.captions.length} captions`)
}

async function renderScene(tl: Timeline, s: TimelineScene, duration: number, g: Graphics, file: string) {
  const { width: W, height: H, fps } = tl.video
  const frames = Math.round(duration * fps)
  const args: string[] = []
  if (s.kind === 'video') {
    const from = s.source.type === 'video' ? s.source.from : 0
    args.push('-ss', sec(from), '-t', sec(duration + 0.5), '-i', s.file)
  } else {
    args.push('-loop', '1', '-framerate', String(fps), '-t', sec(duration), '-i', s.file)
  }
  const keys = s.zoom.map(k => ({ ...k, cx: k.cx * UPSCALE, cy: k.cy * UPSCALE }))
  const z = keyExpr(keys, k => +k.scale.toFixed(4), fps)
  const cx = keyExpr(keys, k => k.cx, fps)
  const cy = keyExpr(keys, k => k.cy, fps)
  const chains: string[] = []
  chains.push(`[0:v]${s.kind === 'video' ? `tpad=stop_mode=clone:stop_duration=${sec(duration)},` : ''}` +
    `trim=duration=${sec(duration)},setpts=PTS-STARTPTS,fps=${fps},` +
    `scale=${s.srcW * UPSCALE}:${s.srcH * UPSCALE}:flags=bicubic:out_range=tv,` +
    `zoompan=z='${z}':x='clip(${cx}-iw/zoom/2,0,iw-iw/zoom)':y='clip(${cy}-ih/zoom/2,0,ih-ih/zoom)':d=1:s=${W}x${H}:fps=${fps},` +
    (s.blur ? `gblur=sigma=${s.blur},` : '') + `setsar=1,format=rgba[base]`)
  let last = 'base'
  let idx = 1
  if (s.dim) {
    chains.push(`color=c=${tl.brand.ink.replace('#', '0x')}@${s.dim}:s=${W}x${H}:r=${fps}:d=${sec(duration)},format=rgba[dimc]`)
    chains.push(`[${last}][dimc]overlay=shortest=1[dimmed]`)
    last = 'dimmed'
  }
  const layers = g.cards[s.id] ?? []
  layers.forEach((layer, i) => {
    args.push('-loop', '1', '-framerate', String(fps), '-t', sec(duration), '-i', layer.file)
    const next = layers[i + 1]?.at
    const until = next === undefined ? duration : next + 0.35
    const fadeIn = s.card?.kind === 'hook' ? 0.2 : 0.3
    chains.push(`[${idx}:v]format=rgba,fade=t=in:st=${sec(layer.at)}:d=${fadeIn}:alpha=1[card${i}]`)
    chains.push(`[${last}][card${i}]overlay=0:0:enable='between(t,${sec(layer.at)},${sec(until)})'[c${i}]`)
    last = `c${i}`
    idx++
  })
  for (const [i, sp] of (g.spotlights[s.id] ?? []).entries()) {
    args.push('-loop', '1', '-framerate', String(fps), '-t', sec(duration), '-i', sp.file)
    chains.push(`[${idx}:v]format=rgba,fade=t=in:st=${sec(sp.at)}:d=0.3:alpha=1,fade=t=out:st=${sec(sp.until - 0.3)}:d=0.3:alpha=1[sp${i}]`)
    chains.push(`[${last}][sp${i}]overlay=0:0:enable='between(t,${sec(sp.at)},${sec(sp.until)})'[s${i}]`)
    last = `s${i}`
    idx++
  }
  const badge = g.badges[s.id]
  if (badge && s.badge) {
    // The badge labels the scene, then gets out of the way of the page.
    const outAt = Math.min(s.badge.at + (s.badge.seconds ?? 2.6), s.duration - 0.4)
    args.push('-loop', '1', '-framerate', String(fps), '-t', sec(duration), '-i', badge.file)
    chains.push(`[${idx}:v]format=rgba,fade=t=in:st=${sec(s.badge.at)}:d=0.3:alpha=1,fade=t=out:st=${sec(outAt)}:d=0.35:alpha=1[bdg]`)
    chains.push(`[${last}][bdg]overlay=${badge.x}:${badge.y}:enable='between(t,${sec(s.badge.at)},${sec(outAt + 0.35)})'[withbadge]`)
    last = 'withbadge'
    idx++
  }
  chains.push(`[${last}]format=yuv420p[out]`)
  await ffmpeg([...args, '-filter_complex', chains.join(';'), '-map', '[out]', '-frames:v', String(frames), '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-pix_fmt', 'yuv420p', '-an', file], 20 * 60_000)
}

const transitionLen = (tl: Timeline, i: number) =>
  i < tl.scenes.length - 1 ? ((tl.scenes[i].transition ?? 'fade') === 'none' ? 0.04 : tl.video.transitionSeconds) : 0

async function joinScenes(tl: Timeline, files: string[], outFile: string) {
  const args = files.flatMap(f => ['-i', f])
  const chains: string[] = []
  let last = '0:v'
  let offset = 0
  for (let i = 1; i < files.length; i++) {
    const prev = tl.scenes[i - 1]
    offset += prev.duration
    const tr = prev.transition ?? 'fade'
    chains.push(`[${last}][${i}:v]xfade=transition=${tr === 'none' ? 'fade' : tr}:duration=${transitionLen(tl, i - 1)}:offset=${sec(offset)}[x${i}]`)
    last = `x${i}`
  }
  chains.push(`[${last}]format=yuv420p[out]`)
  await ffmpeg([...args, '-filter_complex', chains.join(';'), '-map', '[out]', '-r', String(tl.video.fps),
    '-frames:v', String(Math.round(tl.video.duration * tl.video.fps)), '-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-pix_fmt', 'yuv420p', outFile])
}

/** Narration stem: clips at their timeline positions, loudness-normalized, full length, stereo. */
async function buildNarration(tl: Timeline, outFile: string) {
  const D = tl.video.duration
  const args = tl.narration.flatMap(c => ['-i', c.file])
  const chains = tl.narration.map((c, i) =>
    `[${i}:a]${tl.voice.tempo !== 1 ? `atempo=${tl.voice.tempo},` : ''}aresample=48000,adelay=${Math.round(c.start * 1000)}:all=1[a${i}]`)
  chains.push(`${tl.narration.map((_, i) => `[a${i}]`).join('')}amix=inputs=${tl.narration.length}:normalize=0:dropout_transition=0,` +
    `apad=whole_dur=${sec(D)},atrim=0:${sec(D)},loudnorm=I=${tl.video.loudnessLufs}:TP=-1.5:LRA=9,aresample=48000,` +
    `aformat=sample_fmts=s16:channel_layouts=stereo[out]`)
  await ffmpeg([...args, '-filter_complex', chains.join(';'), '-map', '[out]', '-c:a', 'pcm_s16le', outFile])
}

/** Music bed (generated or licensed file), normalized to -16 LUFS; finalize sets its level under the narration. */
async function buildMusic(tl: Timeline, work: string): Promise<string | null> {
  if (tl.music.source === 'none') return null
  const D = tl.video.duration
  const fileOut = join(work, 'music.wav')
  if (tl.music.source === 'generated') {
    await generateMusic(fileOut, D, tl.music.bpm)
  } else {
    await ffmpeg(['-stream_loop', '-1', '-i', musicPath(tl.music.file!), '-t', sec(D), '-af',
      `loudnorm=I=-16:TP=-2,afade=t=in:d=1,afade=t=out:st=${sec(D - 2.5)}:d=2.5,aresample=48000,aformat=channel_layouts=stereo`,
      '-c:a', 'pcm_s16le', fileOut])
  }
  return fileOut
}

async function finalize(tl: Timeline, cfg: VideoConfig, base: string, narration: string, music: string | null, g: Graphics, outFile: string) {
  const { fps, duration: D } = tl.video
  const args = ['-i', base, '-i', narration]
  let idx = 2
  let audio: string
  if (music) {
    args.push('-i', music)
    const musicDb = tl.video.loudnessLufs + tl.music.gainDb + 16
    // Duck the music further whenever the narrator speaks; narration stays clearly on top.
    audio = `[1:a]asplit=2[nar][key];[${idx}:a]volume=${musicDb}dB[mus];` +
      `[mus][key]sidechaincompress=threshold=0.015:ratio=6:attack=15:release=380[duck];` +
      `[nar][duck]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.89:level=false[aout]`
    idx++
  } else {
    audio = '[1:a]anull[aout]'
  }
  const chains: string[] = []
  let last = '0:v'
  g.captions.forEach((c, i) => {
    const cap = tl.captions[i]
    args.push('-loop', '1', '-framerate', String(fps), '-t', sec(D), '-i', c.file)
    chains.push(`[${idx}:v]format=rgba,fade=t=in:st=${sec(cap.start)}:d=0.12:alpha=1[cap${i}]`)
    chains.push(`[${last}][cap${i}]overlay=${c.x}:${c.y}:enable='between(t,${sec(cap.start)},${sec(cap.end)})'[v${i}]`)
    last = `v${i}`
    idx++
  })
  chains.push(`[${last}]scale=out_range=tv,format=yuv420p[vout]`, audio)
  await ffmpeg([
    ...args, '-filter_complex', chains.join(';'), '-map', '[vout]', '-map', '[aout]',
    '-frames:v', String(Math.round(D * fps)), '-r', String(fps), '-t', sec(D),
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.2', '-preset', 'slow', '-crf', String(cfg.video.crf), '-pix_fmt', 'yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', cfg.video.audioBitrate, '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-metadata', `title=${tl.title}`, '-metadata:s:a:0', `language=${ISO639_2[cfg.language.split('-')[0]] ?? 'und'}`, outFile,
  ], 20 * 60_000)
}

const SCRIPT_LABELS = {
  vi: {
    destination: 'Điểm đến', language: 'Ngôn ngữ', voice: 'Giọng đọc', draft: 'BẢN NHÁP, không dùng để đăng', speed: 'tốc độ',
    music: 'Nhạc nền', generated: 'nhạc tổng hợp gốc của pipeline (không có nội dung bên thứ ba)', none: 'không',
    narration: 'LỜI DẪN (thời gian theo âm thanh thực tế)', tts: 'VĂN BẢN GỬI TTS', scenes: 'CẢNH', recording: 'quay trang web',
    screenshot: 'ảnh chụp trang web', badge: 'nhãn', source: 'Nguồn', sourceNote: 'trang công khai, không đăng nhập; không gửi yêu cầu nào tới AI',
    skipped: 'Bỏ qua', overlap: 'CẢNH BÁO phụ đề che nút', covers: 'che',
  },
  en: {
    destination: 'Destination', language: 'Language', voice: 'Voice', draft: 'DRAFT, not for publishing', speed: 'speed',
    music: 'Music', generated: 'original bed synthesized by the pipeline (no third-party content)', none: 'none',
    narration: 'NARRATION (timed to the actual audio)', tts: 'TEXT SENT TO TTS', scenes: 'SCENES', recording: 'site recording',
    screenshot: 'site screenshot', badge: 'badge', source: 'Source', sourceNote: 'public pages, no login; nothing sent to the AI',
    skipped: 'Skipped', overlap: 'WARNING captions covering controls', covers: 'covers',
  },
}

function writeScript(tl: Timeline, cfg: VideoConfig, file: string, overlaps: ControlOverlap[]) {
  const L = cfg.language.startsWith('vi') ? SCRIPT_LABELS.vi : SCRIPT_LABELS.en
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
  const lines = [
    tl.title,
    '',
    `${L.destination}: ${tl.destination} · ${L.language}: ${cfg.language} · ${tl.video.duration}s · ${tl.video.width}x${tl.video.height} · ${tl.video.fps}fps`,
    `${L.voice}: ${tl.voice.provider} — ${tl.voice.voice}${tl.voice.production ? '' : ` (${L.draft})`}` +
      (tl.voice.tempo !== 1 ? ` · ${L.speed} ${tl.voice.tempo}x` : ''),
    `${L.music}: ${tl.music.source === 'generated' ? L.generated : tl.music.source === 'file' ? `${tl.music.file} — ${tl.music.license}` : L.none}`,
    '',
    `== ${L.narration} ==`,
    ...tl.narration.map(n => `[${fmt(n.start)} → ${fmt(n.end)}] ${plainCaption(n.caption)}`),
    '',
    `== ${L.tts} ==`,
    ...tl.narration.map(n => `${n.id}: ${n.speak}`),
    '',
    `== ${L.scenes} ==`,
    ...tl.scenes.map(s => `[${fmt(s.start)} → ${fmt(s.end)}] ${s.id}: ${s.kind === 'video' && s.source.type === 'video' ? `${L.recording} (${s.source.shot})` : L.screenshot}` +
      `${s.badge ? ` · ${L.badge} "${s.badge.text}"` : ''}${s.card?.text ? ` · "${s.card.text.replace(/\*\*/g, '')}"` : ''}` +
      `${s.zoom.length > 1 ? ` · zoom ${s.zoom.map(z => z.scale.toFixed(2)).join('→')}` : ''}`),
    '',
    `${L.source}: ${cfg.site.baseUrl} (${L.sourceNote})`,
    ...(tl.skippedFeatures.length ? ['', `${L.skipped}:`, ...tl.skippedFeatures.map(s => `- ${s.id}: ${s.reason}`)] : []),
    ...(overlaps.length ? ['', `${L.overlap}:`, ...overlaps.map(o => `- cue ${o.caption} ${L.covers} "${o.control}" (${o.scene}, ${o.t}s)`)] : []),
  ]
  writeFileSync(file, lines.join('\n') + '\n', 'utf8')
}

async function main() {
  const cfg = loadConfig()
  await requireBinaries(['ffmpeg', 'ffprobe'])
  const d = dirs(cfg)
  const manifestFile = join(d.capture, 'manifest.json')
  if (!existsSync(manifestFile)) throw new Error('No capture manifest. Run: npm run video:capture')
  const manifest = readJson<CaptureManifest>(manifestFile)
  const voice = loadVoice(cfg)
  if (!voice.production) log('render', `WARNING: ${voice.provider} is a draft voice; this render is not publishable`)

  const tl = buildTimeline(cfg, manifest, voice)
  for (const w of tl.warnings) log('render', `warning: ${w}`)
  await validateAssets(tl)
  rmSync(d.work, { recursive: true, force: true })
  ensureDir(d.work)
  const graphics = await renderGraphics(tl, cfg, join(d.work, 'graphics'))
  const overlaps = findOverlaps(tl, graphics)
  for (const o of overlaps) log('render', `warning: caption ${o.caption} covers control "${o.control}" in ${o.scene} at ${o.t}s`)

  const paths = outputPaths(cfg, !voice.production)
  writeJson(paths.timeline, { ...tl, graphics: { captions: graphics.captions }, controlOverlaps: overlaps })
  writeSrt(paths.srt, tl.captions)
  writeScript(tl, cfg, paths.script, overlaps)

  const segs: string[] = []
  for (let i = 0; i < tl.scenes.length; i++) {
    const s = tl.scenes[i]
    const file = join(d.work, `seg-${String(i).padStart(2, '0')}-${s.id}.mp4`)
    log('render', `scene ${s.id} ${sec(s.start)}–${sec(s.end)}s`)
    await renderScene(tl, s, s.duration + transitionLen(tl, i), graphics, file)
    segs.push(file)
  }
  const base = join(d.work, 'base.mp4')
  log('render', 'joining scenes')
  await joinScenes(tl, segs, base)
  const narration = join(d.work, 'narration.wav')
  await buildNarration(tl, narration)
  const music = await buildMusic(tl, d.work)
  log('render', 'captions + audio mix + final encode')
  await finalize(tl, cfg, base, narration, music, graphics, paths.video)
  await contactSheet(paths.video, paths.contactSheet)
  log('render', `done: ${rel(paths.video)} (${(await mediaDuration(paths.video)).toFixed(2)}s)${voice.production ? '' : ' — DRAFT voice, not publishable'}`)
}

main().catch(err => {
  console.error(`\n${err instanceof Error ? err.message : err}\n`)
  process.exit(1)
})
