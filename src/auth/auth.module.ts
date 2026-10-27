import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthContextGuard } from '../common/auth/guards'
import { AuthController } from './auth.controller'

@Module({
  controllers: [AuthController],
  providers: [{ provide: APP_GUARD, useClass: AuthContextGuard }]
})
export class AuthModule {}
