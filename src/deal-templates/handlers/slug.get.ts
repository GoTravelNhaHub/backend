import { type HttpEvent, getRouterParam } from '../../common/http'
import { useRuntimeConfig } from '../../config/runtime-config'
import prisma from '../../prisma/prisma.client'
import { getBuiltinDealTemplate } from '../services/builtin-deal-templates'

export async function slugGet(event: HttpEvent) {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    return { success: false, error: 'Slug is required' }
  }

  let template: Awaited<ReturnType<typeof prisma.dealTemplate.findFirst>> = null
  try {
    template = await prisma.dealTemplate.findFirst({
      where: {
        slug,
        isActive: true
      }
    })
  } catch (error: unknown) {
    console.error(
      'Deal template DB lookup failed — trying built-in:',
      error instanceof Error ? error.message : error
    )
  }

  if (template) {
    return {
      success: true,
      data: template
    }
  }

  try {
    const config = useRuntimeConfig()
    const builtin = getBuiltinDealTemplate(slug, config.public as Record<string, unknown>)

    return {
      success: true,
      data: builtin
    }
  } catch (error: unknown) {
    const message = 'Failed to fetch template'
    console.error('Failed to resolve deal template by slug:', error)
    return {
      success: false,
      error: message,
      data: null
    }
  }
}

