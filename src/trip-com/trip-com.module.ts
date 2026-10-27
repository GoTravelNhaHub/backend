import { Module } from '@nestjs/common'
import { TripComController } from './trip-com.controller'
import { TripComService } from './trip-com.service'

@Module({
  controllers: [TripComController],
  providers: [TripComService],
  exports: [TripComService]
})
export class TripComModule {}
