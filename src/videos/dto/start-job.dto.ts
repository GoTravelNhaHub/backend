import * as z from 'zod/v4'
import { STAGES } from '../video-jobs.service'

export const StartJobSchema = z.object({
  /** Config name (file name without .json) */
  config: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  /** Stages to run, in pipeline order. Default: all four. */
  stages: z.array(z.enum(STAGES)).min(1).default([...STAGES]),
  /** Overrides the config's voice provider for this run. `say` makes a DRAFT render. */
  ttsProvider: z.enum(['auto', 'elevenlabs', 'google', 'azure', 'say']).optional(),
  /** Capture only these shot ids (others are reused from the last capture) */
  captureOnly: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(20).optional()
})

export type StartJobInput = z.infer<typeof StartJobSchema>
