import { type HttpEvent, readBody } from '../../common/http'
function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export async function dealTemplatesFetchImagePost(event: HttpEvent) {
  try {
    const body = await readBody<{ url?: string }>(event)
    const url = String(body?.url || '').trim()
    if (!url) {
      return { success: false, error: 'URL is required' }
    }

    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GoTravelNhaBot/1.0)'
      }
    })

    if (!response.ok) {
      return { success: false, error: `Failed to fetch page (${response.status})` }
    }

    const html = await response.text()
    const image = extractMetaImage(html)

    return {
      success: Boolean(image),
      data: image ? { heroImage: image, heroImageSource: 'og', heroImageFetchedAt: new Date().toISOString() } : null,
      error: image ? null : 'No og:image or twitter:image found'
    }
  } catch (error: any) {
    console.error('Failed to auto fetch hero image:', error)
    return {
      success: false,
      error: 'Failed to fetch image metadata'
    }
  }
}

