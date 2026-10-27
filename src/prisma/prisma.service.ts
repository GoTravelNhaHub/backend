import { Injectable, OnModuleDestroy } from '@nestjs/common'
import prisma from './prisma.client'

/**
 * Injectable handle on the one PrismaClient (`prisma.client.ts`). Services that predate
 * Nest import that singleton directly; both are the same client.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client = prisma

  async onModuleDestroy() {
    await prisma.$disconnect()
  }
}
