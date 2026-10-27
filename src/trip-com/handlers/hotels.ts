import { type HttpEvent, readBody } from '../../common/http'
// server/api/trip/hotels.ts
export async function hotels(event: HttpEvent) {
  const body = await readBody(event)

  const now = new Date()
  const clientId = `${Date.now()}.${Math.random().toString(36).slice(2)}`

  const payload = {
    guideLogin: 'T',
    queryTag: 'NORMAL',
    mapType: 'GOOGLE',
    head: {
      platform: 'PC',
      clientId,
      bu: 'ibu',
      group: 'TRIP',
      aid: '3883416',
      sid: '22874365',
      ouid: 'ctag.hash.4tf2uwjhqreu',
      caid: '3883416',
      csid: '22874365',
      couid: 'ctag.hash.4tf2uwjhqreu',
      region: 'US',
      locale: 'en-US',
      timeZone: '8',
      currency: 'SGD',
      p: '39036036310',
      pageID: '10320668148',
      deviceID: 'PC',
      frontend: {
        vid: clientId,
        sessionID: '97',
        pvid: '7'
      },
      extension: [
        { name: 'cityId', value: body.cityId.toString() },
        { name: 'checkIn', value: '' },
        { name: 'checkOut', value: '' },
        { name: 'region', value: 'US' }
      ],
      qid: '772023443489',
      pid: '09f946a8-627b-4321-9a16-50b5863f99f8',
      cid: clientId,
      traceLogID: 'aefbaf46939aa',
      href: `https://www.trip.com/hotels/list?city=${body.cityId}`,
      deviceConfig: 'L'
    },
    search: {
      sessionId: clientId,
      preHotelCount: 0,
      checkIn: body.checkinDate.replace(/-/g, ''),
      checkOut: body.checkoutDate.replace(/-/g, ''),
      location: {
        geo: {
          countryID: 0,
          provinceID: 0,
          cityID: body.cityId,
          districtID: 0,
          oversea: true
        },
        coordinates: []
      },
      pageCode: 10320668148,
      pageIndex: body.pageIndex || 1,
      pageSize: body.pageSize || 10,
      needTagMerge: 'T',
      roomQuantity: 1,
      orderFieldSelectedByUser: false,
      hotelId: 0,
      hotelIds: [],
      lat: 1.458204,
      lng: 103.769708,
      resultType: 'CT',
      tripWalkDriveSwitch: 'T',
      travellingForWork: false,
      filters: [],
      recommendTimes: 0
    },
    batchRefresh: {
      batchId: '196a0f923b21iqgfi8ti',
      batchSeqNo: 0
    },
    extends: {
      enableDynamicRefresh: 'T',
      isFirstDynamicRefresh: 'F',
      NeedHotelHighLight: 'T'
    },
    tokenList: [
      // Add at least one valid token from their network request
      'eJyrVkrJLC7ISawMKMpMTlWyMjHVUcpNLC5JLfLIL0nN8UxRsjI0MjIyNjAwstRRykksLgktSEksSQ3JzE1VsjI0NzEzMTU3MTAyMzWvBQC/aBdn',
      "eJyrVkrJLC7ISawMKMpMTlWyMrHUUcpNLC5JLfLIL0nN8UxRsjI0MjUxNrc0NNBRykksLgktSEksSQ3JzE1VsjI0NzEzMTU3MTAyMzWvBQDCARd2",
      "eJyrVkrJLC7ISawMKMpMTlWyMjS10FHKTSwuSS3yyC9JzfFMUbIyMzEzNzKy0FHKSSwuCS1ISSxJDcnMBSk2NzEzMTU3MTAyMzWvBQCr9BdK",
      "eJyrVkrJLC7ISawMKMpMTlWyMjHSUcpNLC5JLfLIL0nN8UxRsjK2NDE2NrEw01HKSSwuCS1ISSxJDcnMTVWyMjQ3MTMxNTcxMDIzNa8FAK2cF0c=",
      "eJyrVkrJLC7ISawMKMpMTlWysjDUUcpNLC5JLfLIL0nN8UxRsjIyNTc3NjEx0FHKSSwuCS1ISSxJDcnMTVWyMjQ3MTMxNTcxMDIzNa8FAK1CF0I=",
      "eJyrVkrJLC7ISawMKMpMTlWyMjQ00VHKTSwuSS3yyC9JzfFMUbIyNDAxNjU2NDfVUcpJLC4JLUhJLEkNycwFKTc3MTMxNTcxMDIzNa8FANEsF5w=",
      "eJyrVkrJLC7ISawMKMpMTlWyMrXQUcpNLC5JLfLIL0nN8UxRsjKzNDUwNtdRykksLgktSEksSQ3JzE1VsjI0NzEzMTU3MTAyMzWvBQCGixbk",
      "eJyrVkrJLC7ISawMKMpMTlWyMjQw0FHKTSwuSS3yyC9JzfFMUbIytTAzNDO2NNJRykksLgktSEksSQ3JzAWpNjcxMzE1NzEwMjM1rwUAva0Xcg==",
      "eJyrVkrJLC7ISawMKMpMTlWysrDUUcpNLC5JLfLIL0nN8UxRsjI3tDSxNDQz1VHKSSwuCS1ISSxJDcnMTVWyMjQ3MTMxNTcxMDIzNa8FALBzF1Q=",
      "eJyrVkrJLC7ISawMKMpMTlWyMjXWUcpNLC5JLfLIL0nN8UxRsjI0MjOzNDA3MtdRykksLgktSEksSQ3JzE1VsjI0NzEzMTU3MTAyMzWvBQDB8xd5",
      "eJyrVkrJLC7ISawMKMpMTlWyMjQw0lHKTSwuSS3yyC9JzfFMUbIyNDQ2NTI3tjTVUcpJLC4JLUhJLEkNycwFKTc3MTMxNTcxMDIzNa8FANFyF6A="
    ]
  }

  //console.log(`getHotelListDynamicRefresh with payload=${JSON.stringify(payload)}`)
  const response = await fetch('https://www.trip.com/htls/getHotelListDynamicRefresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify(payload)
  })

  const result = await response.json()
  //console.log(`getHotelListDynamicRefresh with result=${JSON.stringify(result)}`)
  return result
}
