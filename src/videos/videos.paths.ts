import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

// Where the video studio lives and writes.
//   studio  src/videos/studio            pipeline sources (ESM, run with tsx; not part of the Nest build)
//   data    VIDEO_STUDIO_DATA_DIR        renders, captures, voice cache, job records (default storage/video-studio)
//   configs <data>/configs               editable video configs, seeded from studio/config on first use

const projectRoot = resolve(__dirname, '..', '..')

export const STUDIO_DIR = resolve(process.env.VIDEO_STUDIO_DIR || join(projectRoot, 'src', 'videos', 'studio'))
export const DATA_DIR = resolve(projectRoot, process.env.VIDEO_STUDIO_DATA_DIR || join('storage', 'video-studio'))
export const OUTPUT_DIR = join(DATA_DIR, 'output')
export const CONFIG_DIR = join(DATA_DIR, 'configs')
export const JOBS_DIR = join(DATA_DIR, 'jobs')

const ensure = (dir: string) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Creates the data folders and copies the bundled configs that are not there yet. */
export function prepareDataDirs() {
  ensure(OUTPUT_DIR)
  ensure(JOBS_DIR)
  ensure(CONFIG_DIR)
  const seed = join(STUDIO_DIR, 'config')
  if (existsSync(seed)) {
    for (const file of readdirSync(seed)) {
      if (file.endsWith('.json') && !existsSync(join(CONFIG_DIR, file))) copyFileSync(join(seed, file), join(CONFIG_DIR, file))
    }
  }
}

export const CONFIG_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

export const configFile = (name: string) => join(CONFIG_DIR, `${name}.json`)

/** Absolute path for a data-relative file (e.g. "output/x.mp4"), or null if it escapes the data folder. */
export function dataPath(rel: string) {
  if (!rel || isAbsolute(rel)) return null
  const full = resolve(DATA_DIR, rel)
  const inside = relative(DATA_DIR, full)
  return inside && !inside.startsWith('..') && !isAbsolute(inside) ? full : null
}
