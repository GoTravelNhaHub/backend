// Original background music, synthesized from scratch (no samples, no third-party material), so it is
// royalty-free by construction. A warm C–G–Am–F pad, a soft bass pulse and a plucked arpeggio.
import { writeFileSync } from 'node:fs'
import { ffmpeg } from './lib.ts'

const SR = 48000
const CHORDS = [
  [48, 52, 55, 60], // C
  [43, 47, 50, 55], // G
  [45, 48, 52, 57], // Am
  [41, 45, 48, 53], // F
]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

function writeWav(file: string, left: Float32Array, right: Float32Array) {
  const n = left.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4)
  }
  writeFileSync(file, buf)
}

export async function generateMusic(outFile: string, seconds: number, bpm = 96) {
  const n = Math.ceil(seconds * SR)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const beat = 60 / bpm
  const bar = beat * 4
  const step = beat / 2
  const xfade = 0.5
  const padTone = (f: number, t: number) => {
    const p = 2 * Math.PI * f * t
    const lfo = 1 + 0.003 * Math.sin(2 * Math.PI * 0.2 * t)
    return 0.6 * Math.sin(p * lfo) + 0.22 * Math.sin(2 * p) + 0.08 * Math.sin(3 * p) + 0.5 * Math.sin(p * 1.004)
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const barIdx = Math.floor(t / bar)
    const inBar = t - barIdx * bar
    const chord = CHORDS[barIdx % CHORDS.length]
    const next = CHORDS[(barIdx + 1) % CHORDS.length]
    // Pad, crossfaded into the next chord at the end of each bar.
    const mix = inBar > bar - xfade ? (inBar - (bar - xfade)) / xfade : 0
    let pad = 0
    for (let k = 0; k < 3; k++) pad += (1 - mix) * padTone(hz(chord[k]), t) + mix * padTone(hz(next[k]), t)
    pad *= 0.045
    // Bass: chord root on every beat, soft attack and decay.
    const inBeat = t % beat
    const bass = 0.11 * Math.sin(2 * Math.PI * hz(chord[0] - 12) * t) * Math.min(1, inBeat / 0.03) * Math.exp(-2.2 * inBeat)
    // Arpeggio: eighth notes over the chord, an octave up, short pluck envelope.
    const sIdx = Math.floor(inBar / step)
    const inStep = inBar - sIdx * step
    const note = chord[ARP[sIdx % ARP.length]] + 12
    const pluck = 0.05 * Math.sin(2 * Math.PI * hz(note) * t) * Math.min(1, inStep / 0.005) * Math.exp(-7 * inStep)
    const pan = sIdx % 2 ? 0.35 : -0.35
    const fade = Math.min(1, t / 1.5) * Math.min(1, (seconds - t) / 2.5)
    L[i] = fade * (pad + bass + pluck * (1 - pan))
    R[i] = fade * (pad * 0.98 + bass + pluck * (1 + pan))
  }
  const dry = outFile.replace(/\.wav$/, '-dry.wav')
  writeWav(dry, L, R)
  // Gentle room and top-end roll-off, then normalize to a known loudness for mixing.
  await ffmpeg(['-i', dry, '-af', 'aecho=0.8:0.6:70|140:0.22|0.12,lowpass=f=5500,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000',
    '-t', String(seconds), '-c:a', 'pcm_s16le', outFile])
}
