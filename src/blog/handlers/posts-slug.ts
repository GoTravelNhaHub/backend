import { type HttpEvent, getRouterParam } from '../../common/http'
import prisma from '../../prisma/prisma.client'

/**
 * GET /api/blog/posts/:slug
 * Get a single blog post by slug
 */
export async function postsSlug(event: HttpEvent) {
  try {
    const slug = getRouterParam(event, 'slug')

    if (!slug) {
      return {
        success: false,
        error: 'Slug is required'
      }
    }

    const post = await prisma.blogPost.findUnique({
      where: {
        slug,
        isPublished: true
      }
    })

    if (!post) {
      return {
        success: false,
        error: 'Post not found'
      }
    }

    // Increment views
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { views: post.views + 1 }
    })

    return {
      success: true,
      data: {
        ...post,
        views: post.views + 1
      }
    }
  } catch (error: any) {
    console.error('Error fetching blog post:', error)
    return {
      success: false,
      error: 'Failed to fetch blog post'
    }
  }
}

