// Family destination guides served at /guides/[slug]. Each guide answers one search
// ("Tokyo itinerary with kids") with original advice, a sample plan and a button that
// opens the AI planner with the same trip.
//
// `draft: true` guides render (with a banner) but are noindex, left out of the sitemap
// and the /guides list. Remove the flag once the content has been checked.
// Costs are estimates written by us, never partner prices; leave `costs` null until checked.

export interface GuideDay {
  title: string
  morning: string
  afternoon: string
  evening: string
  tip?: string
}

export interface GuideCostLine {
  item: string
  estimate: string
  note?: string
}

export interface DestinationGuide {
  slug: string
  /** Must match a name in utils/destination-catalog.ts so the guide links to its destination page */
  destination: string
  title: string
  metaTitle: string
  description: string
  days: number
  /** Who the plan suits, shown under the title, e.g. "Ages 3–12 · relaxed pace" */
  suits: string
  /** YYYY-MM-DD, shown as "Updated" */
  updated: string
  draft?: boolean
  intro: string[]
  itinerary: GuideDay[]
  costs: { currency: string; lines: GuideCostLine[]; note: string } | null
  tips: string[]
  faqs: { question: string; answer: string }[]
  /** Sent to /planner?prompt= */
  plannerPrompt: string
}

export const GUIDES: DestinationGuide[] = [
  {
    slug: 'tokyo-with-kids-5-days',
    destination: 'Tokyo',
    title: '5 days in Tokyo with kids',
    metaTitle: '5 Days in Tokyo with Kids: Family Itinerary | GoTravelNha',
    description:
      'A relaxed 5-day Tokyo itinerary for families: zoos, science museums, a Disney day and easy neighbourhoods, with tips for trains, strollers and meals.',
    days: 5,
    suits: 'Ages 3–12 · relaxed pace · first visit',
    updated: '2026-10-15',
    draft: true,
    intro: [
      'Tokyo is one of the easiest big cities to visit with children: trains are clean and punctual, stations have lifts, and convenience stores sell decent food at any hour.',
      'This plan keeps one area per day so travel stays short, puts the busiest sight early in the morning, and leaves late afternoons free for naps or a playground.'
    ],
    itinerary: [
      {
        title: 'Asakusa and the river',
        morning: 'Senso-ji temple and the Nakamise shopping street before the crowds arrive.',
        afternoon: 'Tokyo Skytree and the Sumida Aquarium in the same building, good if it rains.',
        evening: 'Early dinner near the hotel. The first night is usually about jet lag.',
        tip: 'Get IC transport cards (Suica or PASMO) on day one; children can have their own.'
      },
      {
        title: 'Ueno park, zoo and museums',
        morning: 'Ueno Zoo. Pandas are popular, so go first.',
        afternoon: 'National Museum of Nature and Science, a short walk across the park.',
        evening: 'Ameyoko market street for snacks and souvenirs.',
        tip: 'Ueno Zoo usually closes on Mondays. Check opening days before you go.'
      },
      {
        title: 'Tokyo Disneyland or DisneySea',
        morning: 'Arrive before opening; the first hour has the shortest queues.',
        afternoon: 'Take a break back at the hotel if the children are small, then return for the evening parade.',
        evening: 'Fireworks and parades depend on the day and season.',
        tip: 'Tickets are dated and sell out in school holidays. Buy them online in advance.'
      },
      {
        title: 'Odaiba and Toyosu',
        morning: 'teamLab Planets, a walk-through digital art museum (book a time slot).',
        afternoon: 'Miraikan science museum, then the Odaiba seaside park.',
        evening: 'Shopping malls in Odaiba have family restaurants and indoor play areas.',
        tip: 'Miraikan usually closes on Tuesdays.'
      },
      {
        title: 'Harajuku, Yoyogi and Shibuya',
        morning: 'Meiji Jingu shrine and a run around Yoyogi Park.',
        afternoon: 'Takeshita Street sweets, then the Shibuya crossing and the Pokémon Center.',
        evening: 'Pack and rest before the flight.'
      }
    ],
    // Fill in checked estimates (tickets, transport, meals per day) before removing `draft`
    costs: null,
    tips: [
      'Avoid trains at morning rush hour (roughly 7:30–9:30) with a stroller.',
      'Department stores and large stations have baby rooms with changing tables and nursing space.',
      'Many restaurants are small. Eat earlier than locals, around 5:30 pm, to get a table.',
      'Coin lockers at big stations let you leave bags and shopping for the afternoon.'
    ],
    faqs: [
      {
        question: 'Is Tokyo good for toddlers?',
        answer:
          'Yes. Streets are safe and clean, most stations have lifts, and baby rooms are common in shops. Plan one main activity a day and use a light stroller.'
      },
      {
        question: 'When is the best time to visit Tokyo with children?',
        answer:
          'Spring (late March to April) and autumn (October to November) are the most comfortable. Summer is hot and humid, and Golden Week in late April to early May is very busy.'
      },
      {
        question: 'Is 5 days enough for Tokyo with kids?',
        answer:
          'Five days covers the main family sights at a relaxed pace, including one theme park day. Add a day for a trip to Kamakura or Yokohama.'
      }
    ],
    plannerPrompt: '5 days in Tokyo with 2 adults and 2 kids, relaxed pace, zoo, science museum and one Disney day'
  }
]

export const publishedGuides = () => GUIDES.filter((guide) => !guide.draft)

export const findGuide = (slug: string) => GUIDES.find((guide) => guide.slug === slug)

export const guideForDestination = (destination: string) =>
  publishedGuides().find((guide) => guide.destination.toLowerCase() === destination.toLowerCase())
