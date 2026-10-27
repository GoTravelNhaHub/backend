import { type HttpEvent, createError, readBody } from '../../common/http'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { AgentTurnSchema, runAgentTurn } from '../services/planner-agent'

// A chat turn is a short model call. The itinerary itself is still built and
// rate limited by /api/planner/itinerary.
export async function chatPost(event: HttpEvent) {
  enforceRateLimit(event.req, 'planner-chat', 30, 10 * 60 * 1000)

  const parsed = AgentTurnSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Please check your message and try again.' })
  }

  return { success: true, ...(await runAgentTurn(parsed.data)) }
}

// Request body schema, used by the controller's Swagger docs
export { AgentTurnSchema as chatPostBodySchema }
