const { Redis } = require('@upstash/redis')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const QUEUE_KEY = 'pulseboard:queue'
const BATCH_SIZE = 50
const POLL_INTERVAL_MS = 1000

let totalProcessed = 0
let totalErrors = 0

console.log('Worker started. Polling queue every ' + POLL_INTERVAL_MS + 'ms, batch size ' + BATCH_SIZE)

async function processBatch() {
  try {
    const rawEvents = []

    for (let i = 0; i < BATCH_SIZE; i++) {
      const item = await redis.rpop(QUEUE_KEY)
      if (!item) break
      rawEvents.push(item)
    }

    if (rawEvents.length === 0) {
      return
    }

    const events = rawEvents.map(function (raw) {
      return typeof raw === 'string' ? JSON.parse(raw) : raw
    })

    const insertResult = await supabase.from('price_events').insert(events)

    if (insertResult.error) {
      console.error('Batch insert failed:', insertResult.error)
      totalErrors += events.length
    } else {
      totalProcessed += events.length
      const queueLength = await redis.llen(QUEUE_KEY)
      console.log('Processed batch of ' + events.length + '. Total processed: ' + totalProcessed + '. Queue depth: ' + queueLength)
    }
  } catch (err) {
    console.error('Worker error:', err)
  }
}

setInterval(processBatch, POLL_INTERVAL_MS)
