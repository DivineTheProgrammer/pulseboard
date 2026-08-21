const WebSocket = require('ws')
const { Redis } = require('@upstash/redis')
require('dotenv').config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const SYMBOL = 'btcusdt'
const QUEUE_KEY = 'pulseboard:queue'
const FLUSH_INTERVAL_MS = 2000

console.log('Connecting to Binance WebSocket for ' + SYMBOL + '...')

const ws = new WebSocket('wss://stream.binance.com:9443/ws/' + SYMBOL + '@trade')

let buffer = []
let eventCount = 0
let requestCount = 0

ws.on('open', function () {
  console.log('Connected. Listening for live trades...')
})

ws.on('message', function (data) {
  try {
    const trade = JSON.parse(data.toString())

    const event = {
      symbol: trade.s,
      price: parseFloat(trade.p),
      source: 'binance',
      event_time: new Date(trade.T).toISOString(),
    }

    buffer.push(JSON.stringify(event))
    eventCount++
  } catch (err) {
    console.error('Error processing message:', err)
  }
})

async function flushBuffer() {
  if (buffer.length === 0) return

  const toSend = buffer
  buffer = []

  try {
    const pipeline = redis.pipeline()
    toSend.forEach(function (item) {
      pipeline.lpush(QUEUE_KEY, item)
    })
    await pipeline.exec()

    requestCount++
    console.log('Flushed ' + toSend.length + ' events in 1 request. Total events: ' + eventCount + '. Total requests used: ' + requestCount)
  } catch (err) {
    console.error('Flush error:', err.message || err)
  }
}

setInterval(flushBuffer, FLUSH_INTERVAL_MS)

ws.on('error', function (err) {
  console.error('WebSocket error:', err)
})

ws.on('close', function () {
  console.log('Connection closed.')
})
