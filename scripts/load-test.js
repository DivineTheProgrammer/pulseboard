const { Redis } = require('@upstash/redis')
require('dotenv').config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const QUEUE_KEY = 'pulseboard:queue'
const TOTAL_EVENTS = 2000
const BATCH_SIZE = 100
const DELAY_BETWEEN_BATCHES_MS = 50

async function runLoadTest() {
  console.log('Starting load test: ' + TOTAL_EVENTS + ' synthetic events, ' + BATCH_SIZE + ' per batch, ' + DELAY_BETWEEN_BATCHES_MS + 'ms between batches')

  const startTime = Date.now()
  let sent = 0

  while (sent < TOTAL_EVENTS) {
    const batchCount = Math.min(BATCH_SIZE, TOTAL_EVENTS - sent)
    const batch = []

    for (let i = 0; i < batchCount; i++) {
      const event = {
        symbol: 'LOADTEST',
        price: 1000 + Math.random() * 100,
        source: 'load-test',
        event_time: new Date().toISOString(),
      }
      batch.push(JSON.stringify(event))
    }

    const pipeline = redis.pipeline()
    batch.forEach(function (item) {
      pipeline.lpush(QUEUE_KEY, item)
    })
    await pipeline.exec()

    sent += batchCount

    if (sent % 500 === 0 || sent === TOTAL_EVENTS) {
      const elapsedMs = Date.now() - startTime
      const rate = Math.round(sent / (elapsedMs / 1000))
      console.log('Sent ' + sent + ' / ' + TOTAL_EVENTS + '. Elapsed: ' + elapsedMs + 'ms. Rate: ' + rate + ' events/sec')
    }

    await new Promise(function (resolve) { setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS) })
  }

  const totalElapsedMs = Date.now() - startTime
  const finalRate = Math.round(TOTAL_EVENTS / (totalElapsedMs / 1000))

  console.log('')
  console.log('=== Load test complete ===')
  console.log('Total events sent: ' + TOTAL_EVENTS)
  console.log('Total time: ' + totalElapsedMs + 'ms')
  console.log('Average send rate: ' + finalRate + ' events/sec')

  const queueLength = await redis.llen(QUEUE_KEY)
  console.log('Current queue depth (events waiting to be processed): ' + queueLength)
}

runLoadTest().catch(function (err) {
  console.error('Load test failed:', err)
})
