import { addKlookAffiliateTracking, addTripAffiliateTracking } from './affiliate-tracking'

export type AffiliateProvider = 'trip' | 'klook' | string

export interface AffiliateLinkContext {
  provider?: string
  entityId?: string
  offerId?: string
  placementKey?: string
  pagePath?: string
  campaign?: string
  sessionId?: string
}

export interface BuildAffiliateLinkInput {
  provider: AffiliateProvider
  baseUrl: string
  context?: AffiliateLinkContext
}

function sanitizeToken(value?: string): string {
  if (!value) return ''
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)
}

export function generateSubId(context: AffiliateLinkContext = {}): string {
  const parts = [
    Date.now().toString(36),
    sanitizeToken(context.provider || ''),
    sanitizeToken(context.entityId),
    sanitizeToken(context.offerId),
    sanitizeToken(context.placementKey),
    sanitizeToken(context.sessionId)
  ].filter(Boolean)

  return parts.join('.').slice(0, 180)
}

function appendCommonTracking(url: string, context: AffiliateLinkContext = {}) {
  const parsed = new URL(url)
  const campaign = sanitizeToken(context.campaign || context.placementKey || 'affiliate')
  // A link that is already tracked keeps its subid, so the click row matches what
  // the partner reports back for commission attribution
  const subId = parsed.searchParams.get('subid') || generateSubId(context)

  if (!parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', 'gotravelnha')
  if (!parsed.searchParams.has('utm_medium')) parsed.searchParams.set('utm_medium', 'affiliate')
  if (campaign && !parsed.searchParams.has('utm_campaign')) parsed.searchParams.set('utm_campaign', campaign)
  if (subId && !parsed.searchParams.has('subid')) parsed.searchParams.set('subid', subId)

  return {
    url: parsed.toString(),
    subId
  }
}

export function buildAffiliateLink(input: BuildAffiliateLinkInput) {
  const provider = input.provider?.toLowerCase()
  const context = {
    ...input.context,
    provider
  }

  let trackedUrl = input.baseUrl
  if (provider === 'trip' || provider === 'trip.com') {
    trackedUrl = addTripAffiliateTracking(input.baseUrl, undefined, undefined, context.campaign)
  } else if (provider === 'klook') {
    trackedUrl = addKlookAffiliateTracking(input.baseUrl, undefined, context.campaign)
  }

  return appendCommonTracking(trackedUrl, context)
}

