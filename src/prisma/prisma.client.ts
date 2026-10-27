import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => new PrismaClient()

type PrismaGlobal = typeof globalThis & {
  prismaClient?: ReturnType<typeof prismaClientSingleton>
}

const globalForPrisma = globalThis as PrismaGlobal
const prisma = globalForPrisma.prismaClient ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaClient = prisma
}

export default prisma

