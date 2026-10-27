// Builds Trip.com search URLs with the route, dates and travellers filled in.
// Affiliate ids are added server-side by /api/affiliate/click, never here.
//
// Hotel city ids were checked against trip.com/hotels/list?city=<id> on 2026-10-12.
// The flight URL format could not be checked (bot protection); confirm by clicking
// a search after deploying.

export interface SearchCity {
  name: string
  /** Trip.com hotel city id */
  hotelCityId: number
  /** IATA city or airport code for flights */
  airport: string
}

export const SEARCH_CITIES: SearchCity[] = [
  { name: 'Singapore', hotelCityId: 73, airport: 'SIN' },
  { name: 'Bangkok', hotelCityId: 359, airport: 'BKK' },
  { name: 'Kuala Lumpur', hotelCityId: 315, airport: 'KUL' },
  { name: 'Hong Kong', hotelCityId: 58, airport: 'HKG' },
  { name: 'Bali', hotelCityId: 723, airport: 'DPS' },
  { name: 'Phuket', hotelCityId: 725, airport: 'HKT' },
  { name: 'Ho Chi Minh City', hotelCityId: 301, airport: 'SGN' },
  { name: 'Hanoi', hotelCityId: 286, airport: 'HAN' },
  { name: 'Taipei', hotelCityId: 617, airport: 'TPE' },
  { name: 'Seoul', hotelCityId: 274, airport: 'SEL' },
  { name: 'Tokyo', hotelCityId: 228, airport: 'TYO' },
  { name: 'Osaka', hotelCityId: 219, airport: 'OSA' },
  { name: 'Sydney', hotelCityId: 501, airport: 'SYD' }
]

const TRIP_BASE = 'https://www.trip.com'

export interface FlightSearch {
  from: string
  to: string
  departDate: string
  returnDate?: string | null
  adults: number
  children: number
  infants: number
  cabin: 'y' | 'c' | 'f'
}

export function tripFlightUrl(search: FlightSearch) {
  const params = new URLSearchParams({
    dcity: search.from.toLowerCase(),
    acity: search.to.toLowerCase(),
    ddate: search.departDate,
    triptype: search.returnDate ? 'rt' : 'ow',
    class: search.cabin,
    quantity: String(search.adults),
    childqty: String(search.children),
    babyqty: String(search.infants),
    searchboxarg: 't',
    locale: 'en-SG',
    curr: 'SGD'
  })
  if (search.returnDate) params.set('rdate', search.returnDate)
  return `${TRIP_BASE}/flights/showfarefirst?${params.toString()}`
}

export interface HotelSearch {
  cityId: number
  /** Optional: without dates Trip.com opens the city list and the visitor picks dates there */
  checkIn?: string
  checkOut?: string
  adults: number
  children: number
  rooms: number
}

export function tripHotelUrl(search: HotelSearch) {
  const params = new URLSearchParams({
    city: String(search.cityId),
    ...(search.checkIn && search.checkOut ? { checkIn: search.checkIn, checkOut: search.checkOut } : {}),
    adult: String(search.adults),
    children: String(search.children),
    crn: String(search.rooms),
    locale: 'en-SG',
    curr: 'SGD'
  })
  return `${TRIP_BASE}/hotels/list?${params.toString()}`
}
