# GoTravelNha Video Studio

Builds 60-second Vietnamese YouTube Shorts (1080×1920, 30 fps, H.264 + AAC, faststart) from real footage of the public site https://www.gotravelnha.com. Each video is one JSON config.

The pipeline lives in the backend (`src/videos/studio`), as ESM TypeScript run with `tsx`. It is not part of the Nest build. The `videos` module (`src/videos`) runs it from **admin → Videos**, one stage per child process, and serves the results. Nothing here deploys, publishes, or writes to the website. Analytics, affiliate and AI-planner endpoints are blocked while capturing, and the planner's send button is never pressed.

Renders, captures, the voice cache, job records and the editable configs live in the data folder `VIDEO_STUDIO_DATA_DIR` (default `backend/storage/video-studio`, gitignored). `config/` here holds the bundled configs that seed `<data>/configs` on first start.

## Stages

From admin → Videos, or from `backend/` on the command line:

```bash
npm run video:install    # once: Playwright Chromium (FFmpeg comes from the OS)
npm run video:capture    # 1. record the public site            → output/capture/<id>/
npm run video:voice      # 2. Vietnamese narration (TTS)         → output/voice/<id>/
npm run video:render     # 3. compose MP4, SRT, script, contact sheet
npm run video:validate   # 4. technical checks + Markdown report (exit 1 on any failure)
npm run video:all        # 1 → 4
```

Each stage reads only what the previous ones wrote:

| Stage | File | Notes |
| --- | --- | --- |
| capture | `src/capture.ts` | Mobile viewport 360×640 at 4.5× → **1620×2880 master frames**, so the composer zooms without upscaling. Each frame is a real device-resolution screenshot. Scrolls and cursor moves step once per frame; waits are sampled in real time. Steps find elements by their real text, role or selector. A missing element is logged and skipped, never faked. `locate` records element rectangles for zoom targets, spotlights and the caption-overlap check. A drawn cursor and tap ripple show real clicks. Brand colors, logo and tagline are read from the live page. |
| voice | `src/voice.ts` | ElevenLabs (`with-timestamps`), Google (SSML marks) or Azure. **Fails with setup instructions if none is configured; it never substitutes silence.** Clips are trimmed to the speech, rejected if silent, and cached by text + voice. `say` is draft-only. |
| render | `src/render.ts` + `timeline.ts`, `subtitles.ts`, `graphics.ts`, `music.ts` | Refuses to run without a matching voice manifest. Places lines in their windows (speeds up at most `maxTempo`). Subtitle cues are aligned to spoken word timings, including split brand names and paraphrases. Zoom is clamped so text is never cut. Spotlights, badges, cards and transitions come from the config. Narration is normalized to −14 LUFS, and the music bed is ducked under it. |
| validate | `src/validate.ts` | See below. Writes `<report>.md` + `.json`. |

A render with a non-production voice writes `…-DRAFT` files, so it can never be mistaken for the deliverable.

## Narration (required)

Put one provider in `backend/.env` (see `backend/.env.example`):

| Provider | Variables | Subtitle timing |
| --- | --- | --- |
| ElevenLabs (recommended) | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (a Vietnamese-capable voice), optional `ELEVENLABS_MODEL_ID` (default `eleven_turbo_v2_5`) | exact (character alignment) |
| Google Cloud TTS | `GOOGLE_TTS_API_KEY` or `GOOGLE_TTS_ACCESS_TOKEN`, optional `GOOGLE_TTS_VOICE` (default `vi-VN-Neural2-A`) | exact (SSML marks) |
| Azure AI Speech | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, optional `AZURE_TTS_VOICE` (default `vi-VN-HoaiMyNeural`) | estimated |
| macOS `say` (draft) | `TTS_PROVIDER=say` | estimated; validation fails `voice:production` |

`TTS_PROVIDER` overrides `voice.provider` in the config. Voice settings (model, stability, rate…) live in the config's `voice` block. Secrets come only from the environment.

## Music

`music.source`:
- `"generated"` (default): an original ambient bed synthesized by `src/music.ts`. It contains no samples or third-party material.
- `"file"`: a licensed track. It requires `music.file` and a non-empty `music.license`.
- `"none"`

`music.gainDb` sets the bed relative to the narration level. Sidechain ducking lowers it further under speech, and validation requires narration at least 8 dB above the music-only gaps.

## Validation

Validation fails the build on:
- missing, draft or effectively silent narration
- any line quieter than −30 dB, or narration less than 8 dB above the music
- duration outside 58–62 s
- resolution ≠ 1080×1920, fps ≠ 30, codec ≠ H.264/AAC, pix_fmt ≠ yuv420p, or no faststart
- frame count ≠ 1800, irregular frame timestamps, decode errors, or black frames
- subtitles that are not NFC, lack diacritics, are out of order, miss a narration line, or are not synced to line starts (±80 ms)
- cues shorter than 0.9 s or faster than 22 chars/s
- captions under 48 px, contrast under 7:1, outside the Shorts safe area, or **covering a clicked/marked control**
- footage that didn't come from the configured host, any skipped capture step, under 30 s of footage, a hook over 3 s, or a missing CTA

Warnings: estimated subtitle timing, long freezes, stale captures, skipped optional shots.

## Config (`config/short-01-v2.json`)

- `title`, `destination`, `language`, `site` (base URL, locale, blocked request patterns)
- `video` — size, fps, duration, transition length, CRF, audio bitrate, loudness target
- `capture.shots[]` — `url`, `skipIfText`, and `steps`:
  - `wait`, `mark` (recording starts here), `screenshot`
  - `scrollBy`, `scrollToText`, `jumpToText`
  - `click` (`text`, `role`, `name`, `navigates`)
  - `locate` (`name`, `text`/`selector`/`role`, `control`)
  - `cursor`
- `voice` — provider and per-provider voice settings, `maxTempo`
- `narration[]` — `window`, `caption`, `speak`:
  - `caption` is the on-screen text: ` | ` starts a new cue, ` / ` a new line, `**x**` highlights.
  - `speak` is the text sent to TTS; it can spell brand names for pronunciation.
- `subtitles` — font, size, colors, box opacity, line limits, top/bottom anchors, reading-speed limits
- `scenes[]` — each scene has:
  - `duration`, `source` (a captured `video` shot + `from`, or a `screenshot`)
  - `zoom` keyframes (`t`, `scale`, `target` element(s) or `center`, `allowCrop`)
  - `spotlight` (`target`, `at`, `until`)
  - `blur`, `dim`, `card` (`hook` / `list` / `brand` / `cta`), `badge`
  - `captionPosition` (`top` / `bottom`), `transition` (xfade name)
- `cta` — title, URL, button, tagline
- `music`
- `output` — deliverable paths

A new video is a new config: **Duplicate** in admin → Videos, or on the command line `VIDEO_CONFIG=config/<file>.json npm run video:all`.

## Outputs (`<data>/output/`)

For `short-01-v2`:
- `gotravelnha-short-01-v2.mp4`
- `short-01-v2.srt`
- `short-01-v2-script.txt`
- `short-01-v2-contact-sheet.jpg` (24 frames, one every 2.5 s)
- `short-01-v2-validation-report.md` / `.json`
- `short-01-v2-timeline.json` (includes caption rectangles and control-overlap results)

Intermediate files go in `output/capture/<id>/` (clips, screenshots, `manifest.json` with step logs and element rectangles), `output/voice/<id>/` and `output/work/<id>/`.

FFmpeg requirements: `ffmpeg`/`ffprobe` with libx264 (tested with Homebrew FFmpeg 9.0.2). `drawtext` and `libass` are not needed, because all text is rendered by Chromium.
