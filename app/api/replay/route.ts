import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const minutesAgo = req.nextUrl.searchParams.get('minutesAgo') || '60'
    const symbol = req.nextUrl.searchParams.get('symbol') || 'BTCUSDT'

    const startTime = new Date(Date.now() - parseInt(minutesAgo) * 60 * 1000).toISOString()

    const result = await supabase
      .from('price_events')
      .select('*')
      .eq('symbol', symbol)
      .gte('event_time', startTime)
      .order('event_time', { ascending: true })
      .limit(2000)

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ events: result.data, count: result.data ? result.data.length : 0 })
  } catch (err) {
    console.error('Replay route error:', err)
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 })
  }
}
