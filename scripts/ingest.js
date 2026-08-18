const WebSocket = require('ws')
const { Redis } = require('@upstash/redis')
require('dotenv').config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const SYMBOL = 'btcusdt'
const QUEUE_KEY = 'pulseboard:queue'

console.log('Connecting to Binance WebSocket for ' + SYMBOL + '...')

const ws = new WebSocket('wss://stream.binance.com:9443/ws/' + SYMBOL + '@trade')

let eventCount = 0

ws.on('open', function () {
  console.log('Connected. Listening for live trades...')
})

ws.on('message', async function (data) {
  try {
    const trade = JSON.parse(data.toString())

    const event = {
      symbol: trade.s,
      price: parseFloat(trade.p),
      source: 'binance',
      event_time: new Date(trade.T).toISOString(),
    }

    await redis.lpush(QUEUE_KEY, JSON.stringify(event))

    eventCount++
    if (eventCount % 10 === 0) {
      console.log('Queued ' + eventCount + ' events so far. Latest: ' + event.symbol + ' @ ' + event.price)
    }
  } catch (err) {
    console.error('Error processing message:', err)
  }
})

ws.on('error', function (err) {
  console.error('WebSocket error:', err)
})

ws.on('close', function () {
  console.log('Connection closed.')
})
