import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness: the process is up and the database answers' })
  check() {
    return this.health.check([
      async () => {
        const db = this.indicator.check('database')
        try {
          await this.prisma.client.$queryRaw`SELECT 1`
          return db.up()
        } catch (error) {
          // Logged, not returned: the Prisma message names the database host
          console.error('[health] database check failed:', error)
          return db.down({ message: 'unreachable' })
        }
      }
    ])
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness: the process is up (no dependencies checked)' })
  live() {
    return { status: 'ok' }
  }
}
