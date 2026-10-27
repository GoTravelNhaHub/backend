import { Module } from '@nestjs/common'
import { AdminAffiliateController } from './admin-affiliate.controller'
import { AdminAnalyticsController } from './admin-analytics.controller'
import { AdminBlogController } from './admin-blog.controller'
import { AdminCommunityController } from './admin-community.controller'
import { AdminDashboardController } from './admin-dashboard.controller'
import { AdminDealTemplatesController } from './admin-deal-templates.controller'
import { AdminKlookController } from './admin-klook.controller'
import { AdminKlookWidgetsController } from './admin-klook-widgets.controller'
import { AdminSupportController } from './admin-support.controller'
import { AdminUsersController } from './admin-users.controller'
import { AdminService } from './admin.service'

@Module({
  controllers: [AdminAffiliateController, AdminAnalyticsController, AdminBlogController, AdminCommunityController, AdminDashboardController, AdminDealTemplatesController, AdminKlookController, AdminKlookWidgetsController, AdminSupportController, AdminUsersController],
  providers: [AdminService],
  exports: [AdminService]
})
export class AdminModule {}
