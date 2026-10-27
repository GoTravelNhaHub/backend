// Stock city photos (Unsplash). Each one was checked to show the named city;
// Phuket uses a generic beach shot because no checked photo of Phuket itself was found.
const PHOTOS: Record<string, string> = {
  singapore: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd',
  bangkok: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf',
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4',
  'hong kong': 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1',
  seoul: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451',
  'kuala lumpur': 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07',
  hanoi: 'https://images.unsplash.com/photo-1555921015-5532091f6026',
  'ho chi minh': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482',
  taipei: 'https://images.unsplash.com/photo-1470004914212-05527e49370b',
  osaka: 'https://images.unsplash.com/photo-1589452271712-64b8a66c7b71',
  sydney: 'https://images.unsplash.com/photo-1524293581917-878a6d017c71',
  phuket: 'https://images.unsplash.com/photo-1537956965359-7573183d1f57'
}

export const destinationPhoto = (destination: string, width = 640) => {
  const needle = destination.toLowerCase()
  const key = Object.keys(PHOTOS).find((city) => needle.includes(city))
  return key ? `${PHOTOS[key]}?auto=format&fit=crop&w=${width}&q=80` : null
}
