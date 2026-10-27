import { Module } from '@nestjs/common'
import { DealTemplatesController } from './deal-templates.controller'
import { DealTemplatesService } from './deal-templates.service'

@Module({
  controllers: [DealTemplatesController],
  providers: [DealTemplatesService],
  exports: [DealTemplatesService]
})
export class DealTemplatesModule {}
