'use client'

import { useEffect, useState, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type PricePoint = {
  time: string
  price: number
}

export default function Home() {
  const [mode, setMode] = useState<'live' | 'replay'>('live')
  const [points, setPoints] = useState<PricePoint[]>([])
  const [connected, setConnected] = useState(false)
  const [eventCount, setEventCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)

  const [replayWindow, setReplayWindow] = useState(1440)
  const [replayLoading, setReplayLoading] = useState(false)
  const [replayEvents, setReplayEvents] = useState<any[]>([])
  const [scrubIndex, setScrubIndex] = useState(0)

  useEffect(function () {
    if (mode !== 'live') {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    const es = new EventSource('/api/stream')
    eventSourceRef.current = es

    es.onopen = function () {
      setConnected(true)
    }

    es.onmessage = function (msg) {
      try {
        const event = JSON.parse(msg.data)
        const point: PricePoint = {
          time: new Date(event.event_time).toLocaleTimeString(),
          price: event.price,
        }

        setPoints(function (prev) {
          const next = prev.concat([point])
          return next.length > 100 ? next.slice(next.length - 100) : next
        })

        setEventCount(function (prev) { return prev + 1 })
      } catch (err) {
        console.error('Failed to parse event:', err)
      }
    }

    es.onerror = function () {
      setConnected(false)
    }

    return function () {
      es.close()
    }
  }, [mode])

  const loadReplay = async () => {
    setReplayLoading(true)
    try {
      const res = await fetch('/api/replay?minutesAgo=' + replayWindow)
      const data = await res.json()
      setReplayEvents(data.events || [])
      setScrubIndex(data.events ? data.events.length : 0)
    } catch (err) {
      console.error('Replay load failed:', err)
    } finally {
      setReplayLoading(false)
    }
  }

  const replayPoints: PricePoint[] = replayEvents.slice(0, scrubIndex).map(function (e) {
    return { time: new Date(e.event_time).toLocaleTimeString(), price: e.price }
  })

  const displayPoints = mode === 'live' ? points : replayPoints
  const latestPrice = displayPoints.length > 0 ? displayPoints[displayPoints.length - 1].price : null

  const pageStyle = { minHeight: '100vh', background: '#0a0a0a', padding: '2rem 1.5rem', fontFamily: '-apple-system, sans-serif' }
  const containerStyle = { maxWidth: '900px', margin: '0 auto' }
  const cardStyle = { background: '#141414', border: '1px solid #232323', borderRadius: '8px', padding: '1.5rem', marginTop: '1.5rem' }
  const badgeStyle = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: connected ? '#3ecf8e' : '#f0576b' }
  const dotStyle = { width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#3ecf8e' : '#f0576b' }
  const toggleButtonStyle = function (active: boolean) {
    return { padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #333', background: active ? '#4f8ef0' : 'transparent', color: active ? '#0a0a0a' : '#ccc', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={{ color: 'white', fontSize: '1.6rem', fontWeight: 700 }}>PulseBoard</h1>
        <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.3rem' }}>Live BTC/USDT trades streamed directly from Binance, plus a replay of recent history.</p>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button onClick={function () { setMode('live') }} style={toggleButtonStyle(mode === 'live')}>Live</button>
          <button onClick={function () { setMode('replay'); loadReplay() }} style={toggleButtonStyle(mode === 'replay')}>Replay</button>
        </div>

        {mode === 'live' && (
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', alignItems: 'center' }}>
            <div style={badgeStyle}>
              <span style={dotStyle}></span>
              {connected ? 'Live' : 'Disconnected'}
            </div>
            <div style={{ color: '#888', fontSize: '0.85rem' }}>{eventCount} events received this session</div>
            <div style={{ color: '#666', fontSize: '0.78rem' }}>Ingestion is paused while a free-tier usage quota resets. See Replay for real historical data.</div>
          </div>
        )}

        {mode === 'replay' && (
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' as const }}>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>Window:</span>
              {[60, 360, 1440, 4320].map(function (mins) {
                const label = mins < 60 ? mins + 'm' : (mins < 1440 ? (mins / 60) + 'h' : (mins / 1440) + 'd')
                return (
                  <button key={mins} onClick={function () { setReplayWindow(mins) }} style={toggleButtonStyle(replayWindow === mins)}>
                    {label}
                  </button>
                )
              })}
              <button onClick={loadReplay} style={{ ...toggleButtonStyle(false), marginLeft: '0.5rem' }}>
                {replayLoading ? 'Loading...' : 'Reload'}
              </button>
            </div>

            {replayEvents.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <input
                  type="range"
                  min={1}
                  max={replayEvents.length}
                  value={scrubIndex}
                  onChange={function (e) { setScrubIndex(parseInt(e.target.value)) }}
                  style={{ width: '100%' }}
                />
                <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  Showing {scrubIndex} of {replayEvents.length} events
                </div>
              </div>
            )}
          </div>
        )}

        {latestPrice !== null && (
          <div style={{ color: 'white', fontSize: '2rem', fontWeight: 700, marginTop: '1rem' }}>
            ${latestPrice.toLocaleString()}
          </div>
        )}

        <div style={cardStyle}>
          {displayPoints.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              {mode === 'live' ? 'Waiting for the first live trade...' : (replayLoading ? 'Loading history...' : 'No historical data in this window. Try a wider window above.')}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={displayPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232323" />
                <XAxis dataKey="time" stroke="#666" fontSize={11} tick={{ fill: '#666' }} />
                <YAxis domain={['auto', 'auto']} stroke="#666" fontSize={11} tick={{ fill: '#666' }} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px' }} />
                <Line type="monotone" dataKey="price" stroke="#4f8ef0" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
