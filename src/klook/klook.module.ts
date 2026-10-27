import { Module } from '@nestjs/common'
import { KlookController } from './klook.controller'
import { KlookService } from './klook.service'

@Module({
  controllers: [KlookController],
  providers: [KlookService],
  exports: [KlookService]
})
export class KlookModule {}
