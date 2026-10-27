// Stage 2 — Vietnamese narration.
// Production providers: ElevenLabs, Google Cloud TTS, Azure Speech. `say` (macOS "Linh") is a draft voice for timing
// previews only; validation rejects it for a publishable render. With no provider configured this stage FAILS:
// it never substitutes silence. Secrets come only from the environment (backend/.env).
import { createHash } from 'node:crypto'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  DATA_ROOT, dirs, ensureDir, ffmpeg, loadConfig, loadDotEnv, log, mediaDuration, readJson, run, writeJson,
  type NarrationLine, type VideoConfig, type VoiceProvider,
} from './lib.ts'

export interface VoiceClip {
  id: string
  /** sha1 of provider + voice + speak text; compose refuses stale clips. */
  key: string
  file: string
  duration: number
  /** Start time (s, relative to the trimmed clip) of each word of `speak`. */
  wordStarts: number[]
  timing: 'provider' | 'estimated'
}

export interface VoiceManifest {
  videoId: string
  provider: VoiceProvider
  voice: string
  production: boolean
  createdAt: string
  clips: VoiceClip[]
}

export const PRODUCTION_PROVIDERS: VoiceProvider[] = ['elevenlabs', 'google', 'azure']

export const voiceManifestPath = (cfg: VideoConfig) => join(dirs(cfg).voice, 'manifest.json')

export const speakWords = (text: string) => text.normalize('NFC').split(/\s+/).filter(Boolean)

export const SETUP_HELP = `No production text-to-speech is configured, so narration cannot be generated.
Configure ONE of these (in backend/.env or the environment), then run: npm run video:voice

  ElevenLabs (recommended):
    ELEVENLABS_API_KEY=...            # https://elevenlabs.io → Profile → API keys
    ELEVENLABS_VOICE_ID=...           # a voice that speaks Vietnamese (Voice Library → filter Vietnamese)
    ELEVENLABS_MODEL_ID=eleven_turbo_v2_5   # optional; must support Vietnamese (turbo/flash v2.5, v3)

  Google Cloud Text-to-Speech:
    GOOGLE_TTS_API_KEY=...            # API key restricted to the Text-to-Speech API
    # or GOOGLE_TTS_ACCESS_TOKEN=$(gcloud auth print-access-token) for an account/project you intend to bill
    GOOGLE_TTS_VOICE=vi-VN-Neural2-A  # optional

  Azure AI Speech:
    AZURE_SPEECH_KEY=...  AZURE_SPEECH_REGION=southeastasia
    AZURE_TTS_VOICE=vi-VN-HoaiMyNeural # optional (or vi-VN-NamMinhNeural)

A draft render with the macOS voice is possible with TTS_PROVIDER=say, but validation marks it as not publishable.`

function configuredProvider(cfg: VideoConfig): VoiceProvider | null {
  const forced = (process.env.TTS_PROVIDER ?? cfg.voice.provider).toLowerCase()
  if (forced !== 'auto') {
    if (!['elevenlabs', 'google', 'azure', 'say'].includes(forced)) throw new Error(`Unknown TTS provider "${forced}"`)
    return forced as VoiceProvider
  }
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs'
  if (process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_TTS_ACCESS_TOKEN) return 'google'
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) return 'azure'
  return null
}

/** An env voice override applies only when it matches this video's language (e.g. vi-VN-… for a vi-VN video). */
function envVoice(name: string, cfg: VideoConfig) {
  const v = process.env[name]
  return v && v.toLowerCase().startsWith(cfg.language.toLowerCase()) ? v : undefined
}

function voiceName(cfg: VideoConfig, provider: VoiceProvider) {
  switch (provider) {
    case 'elevenlabs': return `${process.env.ELEVENLABS_VOICE_ID ?? cfg.voice.elevenlabs.voiceId} / ${process.env.ELEVENLABS_MODEL_ID ?? cfg.voice.elevenlabs.model}`
    case 'google': return envVoice('GOOGLE_TTS_VOICE', cfg) ?? cfg.voice.google.voice
    case 'azure': return envVoice('AZURE_TTS_VOICE', cfg) ?? cfg.voice.azure.voice
    case 'say': return `macOS say ${process.env.SAY_VOICE ?? cfg.voice.say.voice}`
  }
}

interface RawSpeech { file: string; wordStarts?: number[] }

/** Word start times from ElevenLabs character alignment. */
function wordsFromChars(text: string, chars: string[], starts: number[]) {
  const joined = chars.join('')
  const out: number[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  // Alignment characters follow the submitted text; fall back to proportional mapping if they diverge.
  const ratio = joined.length / Math.max(1, text.length)
  while ((m = re.exec(text))) out.push(starts[Math.min(starts.length - 1, Math.round(m.index * ratio))] ?? 0)
  return out
}

async function elevenlabs(cfg: VideoConfig, text: string, base: string): Promise<RawSpeech> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? cfg.voice.elevenlabs.voiceId
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID (or voice.elevenlabs.voiceId in the config) is required')
  const v = cfg.voice.elevenlabs
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID ?? v.model,
      language_code: cfg.voice.language,
      voice_settings: { stability: v.stability, similarity_boost: v.similarityBoost, style: v.style, speed: v.speed, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 400)}`)
  const body = (await res.json()) as {
    audio_base64: string
    alignment?: { characters: string[]; character_start_times_seconds: number[] }
  }
  const file = `${base}.mp3`
  writeFileSync(file, Buffer.from(body.audio_base64, 'base64'))
  const a = body.alignment
  return { file, wordStarts: a ? wordsFromChars(text, a.characters, a.character_start_times_seconds) : undefined }
}

async function google(cfg: VideoConfig, text: string, base: string): Promise<RawSpeech> {
  const key = process.env.GOOGLE_TTS_API_KEY
  const token = process.env.GOOGLE_TTS_ACCESS_TOKEN
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // A mark before every word gives exact word start times for subtitle sync.
  const ssml = `<speak>${speakWords(text).map((w, i) => `<mark name="w${i}"/>${esc(w)}`).join(' ')}</speak>`
  const res = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize${key ? `?key=${encodeURIComponent(key)}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? {} : { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({
      input: { ssml },
      voice: { languageCode: cfg.language, name: envVoice('GOOGLE_TTS_VOICE', cfg) ?? cfg.voice.google.voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: Number(process.env.GOOGLE_TTS_RATE ?? cfg.voice.google.speakingRate), sampleRateHertz: 48000 },
      enableTimePointing: ['SSML_MARK'],
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 400)}`)
  const body = (await res.json()) as { audioContent: string; timepoints?: { markName: string; timeSeconds: number }[] }
  const file = `${base}.mp3`
  writeFileSync(file, Buffer.from(body.audioContent, 'base64'))
  const tp = body.timepoints ?? []
  const starts = speakWords(text).map((_, i) => tp.find(p => p.markName === `w${i}`)?.timeSeconds)
  return { file, wordStarts: starts.every(s => s !== undefined) ? (starts as number[]) : undefined }
}

async function azure(cfg: VideoConfig, text: string, base: string): Promise<RawSpeech> {
  const region = process.env.AZURE_SPEECH_REGION!
  const voice = envVoice('AZURE_TTS_VOICE', cfg) ?? cfg.voice.azure.voice
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const ssml = `<speak version="1.0" xml:lang="${cfg.language}"><voice name="${voice}"><prosody rate="${cfg.voice.azure.rate}">${esc(text)}</prosody></voice></speak>`
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3',
      'User-Agent': 'gotravelnha-video-studio',
    },
    body: ssml,
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`Azure Speech ${res.status}: ${(await res.text()).slice(0, 400)}`)
  const file = `${base}.mp3`
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return { file }
}

async function say(cfg: VideoConfig, text: string, base: string): Promise<RawSpeech> {
  const file = `${base}.aiff`
  await run('say', ['-v', process.env.SAY_VOICE ?? cfg.voice.say.voice, '-r', String(process.env.SAY_RATE ?? cfg.voice.say.rate), '-o', file, text],
    { timeoutMs: 60_000 })
  return { file }
}

/** Word starts proportional to word length plus punctuation pauses, when the provider gives no timings. */
export function estimateWordStarts(text: string, duration: number) {
  const words = speakWords(text)
  const weights = words.map(w => w.length + 2 + (/[,;:]$/.test(w) ? 5 : /[.!?…]$/.test(w) ? 7 : 0))
  const total = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  return words.map((_, i) => {
    const t = (acc / total) * duration
    acc += weights[i]
    return +t.toFixed(3)
  })
}

/** Leading/trailing silence bounds from silencedetect. */
async function speechBounds(file: string) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-42dB:d=0.06', '-f', 'null', '-'])
  const total = await mediaDuration(file)
  const starts = [...stderr.matchAll(/silence_start: (-?[\d.]+)/g)].map(m => Number(m[1]))
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]))
  const lead = starts.length && starts[0] <= 0.02 && ends.length ? ends[0] : 0
  const lastStart = starts[starts.length - 1]
  const trail = lastStart !== undefined && lastStart > lead && (ends.length < starts.length || ends[ends.length - 1] >= total - 0.02) ? lastStart : total
  return { start: Math.max(0, lead - 0.04), end: Math.min(total, trail + 0.08) }
}

export async function generateVoice(cfg: VideoConfig): Promise<VoiceManifest> {
  loadDotEnv()
  const provider = configuredProvider(cfg)
  if (!provider) throw new Error(SETUP_HELP)
  const voice = voiceName(cfg, provider)
  const dir = ensureDir(dirs(cfg).voice)
  const clips: VoiceClip[] = []
  for (const line of cfg.narration) clips.push(await synthesizeLine(cfg, provider, voice, line, dir))
  const manifest: VoiceManifest = {
    videoId: cfg.id, provider, voice, production: PRODUCTION_PROVIDERS.includes(provider), createdAt: new Date().toISOString(), clips,
  }
  writeJson(voiceManifestPath(cfg), manifest)
  return manifest
}

export function lineKey(provider: VoiceProvider, voice: string, line: NarrationLine) {
  return createHash('sha1').update(`${provider}|${voice}|${line.speak.normalize('NFC')}`).digest('hex').slice(0, 12)
}

async function synthesizeLine(cfg: VideoConfig, provider: VoiceProvider, voice: string, line: NarrationLine, dir: string): Promise<VoiceClip> {
  const key = lineKey(provider, voice, line)
  const wav = join(dir, `${line.id}-${key}.wav`)
  const meta = join(dir, `${line.id}-${key}.json`)
  if (existsSync(wav) && existsSync(meta)) {
    log('voice', `${line.id}: cached`)
    return readJson<VoiceClip>(meta)
  }
  const base = join(dir, `${line.id}-${key}-raw`)
  let raw: RawSpeech | undefined
  for (let attempt = 1; !raw; attempt++) {
    try {
      raw = provider === 'elevenlabs' ? await elevenlabs(cfg, line.speak, base)
        : provider === 'google' ? await google(cfg, line.speak, base)
          : provider === 'azure' ? await azure(cfg, line.speak, base) : await say(cfg, line.speak, base)
    } catch (err) {
      if (attempt >= 3 || /\b(401|403|404|422)\b/.test((err as Error).message)) throw err
      log('voice', `${line.id} attempt ${attempt} failed: ${(err as Error).message.split('\n')[0]}`)
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  // Trim edge silence so the line starts exactly where the timeline places it.
  const { start, end } = await speechBounds(raw.file)
  await ffmpeg(['-i', raw.file, '-af', `atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:d=0.02`, '-ar', '48000', '-ac', '1', wav])
  rmSync(raw.file, { force: true })
  const duration = await mediaDuration(wav)
  if (duration < 0.4) throw new Error(`TTS clip ${line.id} is empty (${duration.toFixed(2)}s)`)
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'])
  const mean = Number(stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? -91)
  if (mean < -40) throw new Error(`TTS clip ${line.id} is effectively silent (mean ${mean} dB)`)
  const clip: VoiceClip = {
    id: line.id, key, file: relative(DATA_ROOT, wav), duration: +duration.toFixed(3),
    wordStarts: raw.wordStarts
      ? raw.wordStarts.map(t => +Math.max(0, Math.min(duration, t - start)).toFixed(3))
      : estimateWordStarts(line.speak, duration),
    timing: raw.wordStarts ? 'provider' : 'estimated',
  }
  writeJson(meta, clip)
  log('voice', `${line.id}: ${duration.toFixed(2)}s, mean ${mean} dB, timing ${clip.timing}`)
  return clip
}

/** Loads the voice manifest and checks it matches the current narration; throws if missing or stale. */
export function loadVoice(cfg: VideoConfig): VoiceManifest {
  const file = voiceManifestPath(cfg)
  if (!existsSync(file)) throw new Error(`No narration found (${relative(DATA_ROOT, file)}). Run: npm run video:voice\n\n${SETUP_HELP}`)
  const m = readJson<VoiceManifest>(file)
  for (const line of cfg.narration) {
    const clip = m.clips.find(c => c.id === line.id)
    if (!clip) throw new Error(`Narration line "${line.id}" has no audio. Run: npm run video:voice`)
    if (clip.key !== lineKey(m.provider, m.voice, line)) throw new Error(`Narration "${line.id}" changed since synthesis. Run: npm run video:voice`)
    if (!existsSync(join(DATA_ROOT, clip.file))) throw new Error(`Missing audio ${clip.file}. Run: npm run video:voice`)
  }
  return m
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadConfig()
  generateVoice(cfg)
    .then(m => {
      const total = m.clips.reduce((a, c) => a + c.duration, 0)
      log('voice', `${m.provider} (${m.voice}) → ${m.clips.length} clips, ${total.toFixed(1)}s of speech` +
        (m.production ? '' : ' — DRAFT voice, not publishable'))
    })
    .catch(err => {
      console.error(`\n${err instanceof Error ? err.message : err}\n`)
      process.exit(1)
    })
}
