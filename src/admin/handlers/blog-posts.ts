import { type HttpEvent, getQuery, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

/**
 * GET /api/admin/blog/posts - List all posts (admin)
 * POST /api/admin/blog/posts - Create new post
 */
export async function blogPosts(event: HttpEvent) {
  if (event.req.method === 'GET') {
    try {
      const query = getQuery(event)
      const limit = parseInt(query.limit as string) || 20
      const offset = parseInt(query.offset as string) || 0

      const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.blogPost.count()
      ])

      return {
        success: true,
        data: posts,
        total,
        limit,
        offset
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'Something went wrong'
      }
    }
  }

  if (event.req.method === 'POST') {
    try {
      const body = await readBody(event)
      
      const post = await prisma.blogPost.create({
        data: {
          title: body.title,
          slug: body.slug,
          excerpt: body.excerpt,
          content: body.content,
          authorId: body.authorId || 'admin', // TODO: Get from auth
          category: body.category,
          tags: body.tags || [],
          featuredImage: body.featuredImage,
          isPublished: body.isPublished || false,
          publishedAt: body.isPublished ? new Date() : null,
          seoMeta: body.seoMeta
        }
      })

      return {
        success: true,
        data: post
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'Something went wrong'
      }
    }
  }
}

