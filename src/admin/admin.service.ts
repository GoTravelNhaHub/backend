import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { affiliateConversionsImportPost } from './handlers/affiliate-conversions-import.post'
import { affiliateSlotsGet } from './handlers/affiliate-slots.get'
import { affiliateSlotsPost } from './handlers/affiliate-slots.post'
import { analyticsActivitiesGet } from './handlers/analytics-activities.get'
import { analyticsAffiliateGet } from './handlers/analytics-affiliate.get'
import { analyticsAffiliatePerformanceGet } from './handlers/analytics-affiliate-performance.get'
import { analyticsUnitEconomicsGet } from './handlers/analytics-unit-economics.get'
import { blogPosts } from './handlers/blog-posts'
import { communityModeratePost } from './handlers/community-moderate.post'
import { communityReportsGet } from './handlers/community-reports.get'
import { dashboardStatsGet } from './handlers/dashboard-stats.get'
import { dealTemplates } from './handlers/deal-templates'
import { dealTemplatesFetchImagePost } from './handlers/deal-templates-fetch-image.post'
import { dealTemplatesId } from './handlers/deal-templates-id'
import { klookGet } from './handlers/klook.get'
import { klookPost } from './handlers/klook.post'
import { klookWidgets } from './handlers/klook-widgets'
import { klookWidgetsId } from './handlers/klook-widgets-id'
import { supportMessagesGet } from './handlers/support-messages.get'
import { supportMessagesIdPost } from './handlers/support-messages-id.post'
import { users } from './handlers/users'

/** admin use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class AdminService {
  affiliateConversionsImportPost(event: HttpEvent) {
    return affiliateConversionsImportPost(event)
  }

  affiliateSlotsGet(event: HttpEvent) {
    return affiliateSlotsGet(event)
  }

  affiliateSlotsPost(event: HttpEvent) {
    return affiliateSlotsPost(event)
  }

  analyticsActivitiesGet(event: HttpEvent) {
    return analyticsActivitiesGet(event)
  }

  analyticsAffiliateGet(event: HttpEvent) {
    return analyticsAffiliateGet(event)
  }

  analyticsAffiliatePerformanceGet(event: HttpEvent) {
    return analyticsAffiliatePerformanceGet(event)
  }

  analyticsUnitEconomicsGet(event: HttpEvent) {
    return analyticsUnitEconomicsGet(event)
  }

  blogPosts(event: HttpEvent) {
    return blogPosts(event)
  }

  communityModeratePost(event: HttpEvent) {
    return communityModeratePost(event)
  }

  communityReportsGet(event: HttpEvent) {
    return communityReportsGet(event)
  }

  dashboardStatsGet(event: HttpEvent) {
    return dashboardStatsGet(event)
  }

  dealTemplates(event: HttpEvent) {
    return dealTemplates(event)
  }

  dealTemplatesFetchImagePost(event: HttpEvent) {
    return dealTemplatesFetchImagePost(event)
  }

  dealTemplatesId(event: HttpEvent) {
    return dealTemplatesId(event)
  }

  klookGet(event: HttpEvent) {
    return klookGet(event)
  }

  klookPost(event: HttpEvent) {
    return klookPost(event)
  }

  klookWidgets(event: HttpEvent) {
    return klookWidgets(event)
  }

  klookWidgetsId(event: HttpEvent) {
    return klookWidgetsId(event)
  }

  supportMessagesGet(event: HttpEvent) {
    return supportMessagesGet(event)
  }

  supportMessagesIdPost(event: HttpEvent) {
    return supportMessagesIdPost(event)
  }

  users(event: HttpEvent) {
    return users(event)
  }
}
