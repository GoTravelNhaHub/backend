import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { OriginCheckMiddleware } from './common/middleware/origin-check.middleware'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { AdminModule } from './admin/admin.module'
import { AffiliateModule } from './affiliate/affiliate.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { BlogModule } from './blog/blog.module'
import { CommunityModule } from './community/community.module'
import { ContactModule } from './contact/contact.module'
import { DealTemplatesModule } from './deal-templates/deal-templates.module'
import { DestinationsModule } from './destinations/destinations.module'
import { ExchangeModule } from './exchange/exchange.module'
import { KlookModule } from './klook/klook.module'
import { NewsletterModule } from './newsletter/newsletter.module'
import { PlannerModule } from './planner/planner.module'
import { ReferralsModule } from './referrals/referrals.module'
import { SearchModule } from './search/search.module'
import { SeoModule } from './seo/seo.module'
import { ShareModule } from './share/share.module'
import { TravellersModule } from './travellers/travellers.module'
import { TripComModule } from './trip-com/trip-com.module'
import { TripsModule } from './trips/trips.module'
import { UsersModule } from './users/users.module'
import { VideosModule } from './videos/videos.module'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    AdminModule,
    AffiliateModule,
    AnalyticsModule,
    BlogModule,
    CommunityModule,
    ContactModule,
    DealTemplatesModule,
    DestinationsModule,
    ExchangeModule,
    KlookModule,
    NewsletterModule,
    PlannerModule,
    ReferralsModule,
    SearchModule,
    SeoModule,
    ShareModule,
    TravellersModule,
    TripComModule,
    TripsModule,
    UsersModule,
    VideosModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginCheckMiddleware).forRoutes('*')
  }
}
