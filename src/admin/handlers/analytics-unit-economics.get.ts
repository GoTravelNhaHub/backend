import { type HttpEvent, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { channelOf } from '../../common/utils/attribution'

const MAX_CLICKS_FOR_CHANNELS = 20000

const round2 = (value: number) => Math.round(value * 100) / 100

// Affiliate economics: clicks and partner commissions, overall and per acquisition channel.
// Window is by click/conversion creation date.
export async function analyticsUnitEconomicsGet(event: HttpEvent) {
  const query = getQuery(event)
  const days = Math.min(Math.max(Number.parseInt(String(query.days ?? '30'), 10) || 30, 1), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [clicksByProvider, conversions, conversionRows, clickRows] = await Promise.all([
    prisma.affiliateClickEvent.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: since } },
      _count: { _all: true }
    }),
    prisma.affiliateConversionEvent.groupBy({
      by: ['provider', 'currency'],
      where: { createdAt: { gte: since }, NOT: { status: 'rejected' } },
      _count: { _all: true },
      _sum: { commission: true, saleAmount: true }
    }),
    prisma.affiliateConversionEvent.findMany({
      where: { createdAt: { gte: since }, NOT: { status: 'rejected' } },
      select: { subId: true, commission: true, currency: true }
    }),
    prisma.affiliateClickEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { subId: true, metadata: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_CLICKS_FOR_CHANNELS
    })
  ])

  // Per acquisition channel (first touch). Commission is joined to clicks on subId.
  type ChannelRow = { channel: string; clicks: number; commission: Record<string, number> }
  const channels = new Map<string, ChannelRow>()
  const channelRow = (channel: string) => {
    let row = channels.get(channel)
    if (!row) {
      row = { channel, clicks: 0, commission: {} }
      channels.set(channel, row)
    }
    return row
  }
  const channelBySubId = new Map<string, string>()
  for (const click of clickRows) {
    const channel = channelOf((click.metadata as { attribution?: unknown } | null)?.attribution)
    channelRow(channel).clicks += 1
    if (click.subId) channelBySubId.set(click.subId, channel)
  }
  for (const conversion of conversionRows) {
    const row = channelRow(channelBySubId.get(conversion.subId) ?? 'unknown')
    const currency = conversion.currency ?? 'USD'
    row.commission[currency] = (row.commission[currency] ?? 0) + (conversion.commission ?? 0)
  }

  const clicksByProviderMap = new Map(clicksByProvider.map((row) => [row.provider, row._count._all]))

  return {
    success: true,
    data: {
      days,
      byChannel: [...channels.values()]
        .map((row) => ({
          ...row,
          commission: Object.fromEntries(Object.entries(row.commission).map(([currency, value]) => [currency, round2(value)]))
        }))
        .sort((a, b) => b.clicks - a.clicks),
      channelClicksSampled: clickRows.length === MAX_CLICKS_FOR_CHANNELS,
      affiliate: {
        clicksByProvider: clicksByProvider
          .map((row) => ({ provider: row.provider, clicks: row._count._all }))
          .sort((a, b) => b.clicks - a.clicks),
        conversions: conversions.map((row) => {
          const clicks = clicksByProviderMap.get(row.provider) ?? 0
          const commission = row._sum.commission ?? 0
          return {
            provider: row.provider,
            currency: row.currency ?? 'USD',
            conversions: row._count._all,
            sales: round2(row._sum.saleAmount ?? 0),
            commission: round2(commission),
            commissionPerClick: clicks ? Math.round((commission / clicks) * 10000) / 10000 : 0,
            conversionRate: clicks ? round2((row._count._all / clicks) * 100) : 0
          }
        })
      }
    }
  }
}
