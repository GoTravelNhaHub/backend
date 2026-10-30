import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

/** Shared Anthropic client. Sends the workspace header when ANTHROPIC_WORKSPACE_ID is set. */
export const getAnthropic = () => {
  if (!client) {
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
    client = new Anthropic(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : undefined)
  }
  return client
}
