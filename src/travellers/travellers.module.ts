import { Module } from '@nestjs/common'
import { TravellersController } from './travellers.controller'
import { TravellersService } from './travellers.service'

@Module({
  controllers: [TravellersController],
  providers: [TravellersService],
  exports: [TravellersService]
})
export class TravellersModule {}
