import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let lastEventTime = new Date().toISOString()
  let isClosed = false
  let intervalId: NodeJS.Timeout

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'))

      intervalId = setInterval(async function () {
        if (isClosed) return

        try {
          const result = await supabase
            .from('price_events')
            .select('*')
            .gt('event_time', lastEventTime)
            .order('event_time', { ascending: true })
            .limit(50)

          if (isClosed) return

          if (result.data && result.data.length > 0) {
            lastEventTime = result.data[result.data.length - 1].event_time

            for (const event of result.data) {
              const message = 'data: ' + JSON.stringify(event) + '\n\n'
              try {
                controller.enqueue(encoder.encode(message))
              } catch (enqueueErr) {
                isClosed = true
                clearInterval(intervalId)
                return
              }
            }
          }
        } catch (err) {
          console.error('Stream polling error:', err)
        }
      }, 1000)

      setTimeout(function () {
        if (!isClosed) {
          isClosed = true
          clearInterval(intervalId)
          try {
            controller.close()
          } catch {}
        }
      }, 1000 * 60 * 30)
    },
    cancel() {
      isClosed = true
      clearInterval(intervalId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
