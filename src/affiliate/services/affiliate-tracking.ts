/**
 * Affiliate Tracking Utilities
 * Adds affiliate tracking parameters to URLs for commission tracking
 */

import { unwrapKlookAffiliateRedirectUrl } from '../../shared/utils/unwrapKlookAffiliateRedirect'

/**
 * Add Trip.com affiliate tracking to a URL
 * @param url Original Trip.com URL
 * @param allianceId Trip.com Alliance ID (default from env)
 * @param sid Trip.com SID (default from env)
 * @param campaign Optional campaign identifier
 * @returns URL with affiliate tracking parameters
 */
export function addTripAffiliateTracking(
  url: string,
  allianceId?: string,
  sid?: string,
  campaign?: string
): string {
  try {
    const parsedUrl = new URL(url)
    
    // Get affiliate IDs from env if not provided
    const finalAllianceId = allianceId || process.env.TRIP_ALLIANCE_ID || '3883416'
    const finalSid = sid || process.env.TRIP_SID || '22874365'
    
    // Add affiliate parameters if not already present
    if (!parsedUrl.searchParams.has('Allianceid')) {
      parsedUrl.searchParams.set('Allianceid', finalAllianceId)
    }
    if (!parsedUrl.searchParams.has('SID')) {
      parsedUrl.searchParams.set('SID', finalSid)
    }
    
    // Add campaign tracking if provided
    if (campaign && !parsedUrl.searchParams.has('trip_campaign')) {
      parsedUrl.searchParams.set('trip_campaign', campaign)
    }
    
    // Add source tracking
    if (!parsedUrl.searchParams.has('utm_source')) {
      parsedUrl.searchParams.set('utm_source', 'gotravelnha')
    }
    if (!parsedUrl.searchParams.has('utm_medium')) {
      parsedUrl.searchParams.set('utm_medium', 'affiliate')
    }
    
    return parsedUrl.toString()
  } catch (error) {
    // If URL parsing fails, try to append parameters manually
    const separator = url.includes('?') ? '&' : '?'
    const finalAllianceId = allianceId || process.env.TRIP_ALLIANCE_ID || '3883416'
    const finalSid = sid || process.env.TRIP_SID || '22874365'
    
    let trackedUrl = `${url}${separator}Allianceid=${finalAllianceId}&SID=${finalSid}&utm_source=gotravelnha&utm_medium=affiliate`
    
    if (campaign) {
      trackedUrl += `&trip_campaign=${encodeURIComponent(campaign)}`
    }
    
    return trackedUrl
  }
}

/**
 * Add Klook affiliate tracking to a URL
 * @param url Original Klook URL
 * @param adId Klook Ad ID (default from env)
 * @param campaign Optional campaign identifier
 * @returns URL with affiliate tracking parameters
 */
export function addKlookAffiliateTracking(
  url: string,
  adId?: string,
  campaign?: string
): string {
  url = unwrapKlookAffiliateRedirectUrl(url)
  try {
    const parsedUrl = new URL(url)
    
    // Get affiliate ID from env if not provided
    const finalAdId = adId || process.env.KLOOK_AD_ID || process.env.KLOOK_AFFILIATE_ID || ''
    
    // Klook uses 'aid' parameter for affiliate tracking
    if (finalAdId && !parsedUrl.searchParams.has('aid')) {
      parsedUrl.searchParams.set('aid', finalAdId)
    }
    
    // Add campaign tracking if provided
    if (campaign && !parsedUrl.searchParams.has('utm_campaign')) {
      parsedUrl.searchParams.set('utm_campaign', campaign)
    }
    
    // Add source tracking
    if (!parsedUrl.searchParams.has('utm_source')) {
      parsedUrl.searchParams.set('utm_source', 'gotravelnha')
    }
    if (!parsedUrl.searchParams.has('utm_medium')) {
      parsedUrl.searchParams.set('utm_medium', 'affiliate')
    }
    
    return parsedUrl.toString()
  } catch (error) {
    // If URL parsing fails, try to append parameters manually
    const separator = url.includes('?') ? '&' : '?'
    const finalAdId = adId || process.env.KLOOK_AD_ID || process.env.KLOOK_AFFILIATE_ID || ''
    
    let trackedUrl = `${url}${separator}utm_source=gotravelnha&utm_medium=affiliate`
    
    if (finalAdId) {
      trackedUrl += `&aid=${finalAdId}`
    }
    if (campaign) {
      trackedUrl += `&utm_campaign=${encodeURIComponent(campaign)}`
    }
    
    return trackedUrl
  }
}

