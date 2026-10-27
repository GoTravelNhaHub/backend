// Subtitle cues: authored chunking (" | " = new cue, " / " = new line, **x** = highlight), timed from the
// narration's word start times (provider alignment when available), written as SRT.
import { writeFileSync } from 'node:fs'

export interface Caption {
  index: number
  lineId: string
  start: number
  end: number
  /** Lines with **highlight** markers kept, for rendering. */
  marked: string[]
  /** Plain lines, for SRT. */
  lines: string[]
}

export const stripMarks = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1')

/** Caption text as plain prose (no break or highlight markers). */
export const plainCaption = (text: string) => stripMarks(text.replace(/\s+[|/]\s+/g, ' ')).normalize('NFC')

const words = (s: string) => s.split(/\s+/).filter(Boolean)

/** Greedy word wrap into lines of at most maxChars (used only when a caption has no authored breaks). */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const w of words(text)) {
    if (cur && stripMarks(`${cur} ${w}`).length > maxChars) { lines.push(cur); cur = w } else cur = cur ? `${cur} ${w}` : w
  }
  if (cur) lines.push(cur)
  return lines
}

export function chunkCaption(text: string, maxChars: number, maxLines: number): string[][] {
  const t = text.normalize('NFC')
  if (/\s[|/]\s/.test(t)) return t.split(/\s+\|\s+/).map(c => c.split(/\s+\/\s+/).map(l => l.trim()).filter(Boolean))
  const lines = wrap(t, maxChars)
  const cues: string[][] = []
  for (let i = 0; i < lines.length; i += maxLines) cues.push(lines.slice(i, i + maxLines))
  return cues
}

export interface TimedLine {
  id: string
  start: number
  end: number
  caption: string
  speak: string
  /** Word start times relative to `start`, one per word of `speak`. */
  wordStarts: number[]
  /** Start of the next narration line (cues may hold until just before it). */
  nextStart: number
}

const norm = (w: string) => stripMarks(w).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/**
 * Maps each caption word to the index of the spoken word it corresponds to. Handles words the TTS text splits
 * ("GoTravelNha" ↔ "Go Travel Nha"), joins, and re-syncs after paraphrases ("13" ↔ "Mười ba", ".com" ↔ "chấm com").
 */
export function alignWords(caption: string[], speak: string[]): number[] {
  const c = caption.map(norm)
  const s = speak.map(norm)
  const map: number[] = []
  let i = 0
  let j = 0
  while (i < c.length) {
    if (j >= s.length) { map[i++] = s.length - 1; continue }
    if (c[i] === s[j]) { map[i++] = j++; continue }
    let k = 1
    let joined = s[j]
    while (k < 4 && j + k < s.length && joined.length < c[i].length) joined += s[j + k++]
    if (joined === c[i]) { map[i++] = j; j += k; continue }
    // Re-sync: nearest later pair of identical words, then spread the unmatched stretch proportionally.
    let found: [number, number] | null = null
    for (let di = 0; di <= 4 && !found; di++) {
      for (let dj = 0; dj <= 6; dj++) {
        if ((di || dj) && i + di < c.length && j + dj < s.length && c[i + di] === s[j + dj] && c[i + di].length > 1) { found = [i + di, j + dj]; break }
      }
    }
    const [ni, nj] = found ?? [c.length, s.length]
    for (let x = i; x < ni; x++) map[x] = Math.min(s.length - 1, j + Math.floor(((x - i) * (nj - j)) / Math.max(1, ni - i)))
    i = ni
    j = nj
  }
  return map
}

export function buildCaptions(lines: TimedLine[], maxChars: number, maxLines: number, hold = 0.5): Caption[] {
  const out: Caption[] = []
  for (const line of lines) {
    const cues = chunkCaption(line.caption, maxChars, maxLines)
    const map = alignWords(words(plainCaption(line.caption)), words(line.speak.normalize('NFC')))
    let wordIdx = 0
    const starts = cues.map(cue => {
      const spIdx = map[wordIdx] ?? 0
      wordIdx += words(stripMarks(cue.join(' '))).length
      return line.start + (line.wordStarts[spIdx] ?? 0)
    })
    cues.forEach((cue, i) => {
      const end = i + 1 < cues.length ? starts[i + 1] - 0.03 : Math.min(line.end + hold, line.nextStart - 0.05)
      out.push({
        index: out.length + 1, lineId: line.id, start: +starts[i].toFixed(3), end: +end.toFixed(3),
        marked: cue, lines: cue.map(stripMarks),
      })
    })
  }
  return out
}

const ts = (s: number) => {
  const ms = Math.round(s * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}

export function toSrt(captions: Caption[]) {
  return captions.map(c => `${c.index}\n${ts(c.start)} --> ${ts(c.end)}\n${c.lines.join('\n')}\n`).join('\n')
}

export function writeSrt(file: string, captions: Caption[]) {
  writeFileSync(file, toSrt(captions).normalize('NFC'), 'utf8')
}

export function parseSrt(text: string) {
  const toSec = (t: string) => {
    const [h, m, rest] = t.split(':')
    const [s, ms] = rest.split(',')
    return +h * 3600 + +m * 60 + +s + +ms / 1000
  }
  return text.trim().split(/\r?\n\r?\n/).map(block => {
    const [idx, time, ...lines] = block.split(/\r?\n/)
    const [a, b] = time.split(' --> ')
    return { index: Number(idx), start: toSec(a), end: toSec(b), lines }
  })
}
