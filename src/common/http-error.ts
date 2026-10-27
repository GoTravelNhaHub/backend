import { HttpException } from '@nestjs/common'

/** HttpException that also exposes `statusCode`, which existing catch blocks check (h3 errors had it). */
export class AppHttpError extends HttpException {
  get statusCode() {
    return this.getStatus()
  }
}

/**
 * `throw createError({ statusCode, message })`, as the code did under h3. Becomes a Nest
 * HttpException whose JSON body is `{ statusCode, message }`, so clients still read
 * `error.data.message`.
 */
export function createError(input: { statusCode?: number; message?: string; statusMessage?: string; data?: unknown }) {
  const statusCode = input.statusCode || 500
  const message = input.message || input.statusMessage || 'Server error'
  return new AppHttpError({ statusCode, message, ...(input.data !== undefined ? { data: input.data } : {}) }, statusCode)
}

/** Status code of an error thrown by createError (or any HttpException); undefined otherwise. */
export const errorStatus = (error: any): number | undefined =>
  error instanceof HttpException ? error.getStatus() : typeof error?.statusCode === 'number' ? error.statusCode : undefined
