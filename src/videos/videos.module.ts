import { Module } from '@nestjs/common'
import { VideoJobsService } from './video-jobs.service'
import { VideosController } from './videos.controller'
import { VideosService } from './videos.service'

@Module({
  controllers: [VideosController],
  providers: [VideosService, VideoJobsService]
})
export class VideosModule {}
