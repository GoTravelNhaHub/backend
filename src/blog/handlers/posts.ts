import { type HttpEvent, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

/**
 * GET /api/blog/posts
 * Get all published blog posts (public endpoint)
 */
export async function posts(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const category = query.category as string | undefined
    const limit = parseInt(query.limit as string) || 10
    const offset = parseInt(query.offset as string) || 0

    const where: any = {
      isPublished: true
    }

    if (category) {
      where.category = category
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          category: true,
          tags: true,
          featuredImage: true,
          publishedAt: true,
          views: true,
          createdAt: true
        }
      }),
      prisma.blogPost.count({ where })
    ])

    return {
      success: true,
      data: posts,
      total,
      limit,
      offset
    }
  } catch (error: any) {
    console.error('Error fetching blog posts:', error)
    return {
      success: false,
      error: 'Failed to fetch blog posts'
    }
  }
}

