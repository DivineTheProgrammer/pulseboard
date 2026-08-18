'use client'

import { useEffect, useState, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type PricePoint = {
  time: string
  price: number
}

export default function Home() {
  const [points, setPoints] = useState<PricePoint[]>([])
  const [connected, setConnected] = useState(false)
  const [eventCount, setEventCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(function () {
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
  }, [])

  const pageStyle = { minHeight: '100vh', background: '#0a0a0a', padding: '2rem 1.5rem', fontFamily: '-apple-system, sans-serif' }
  const containerStyle = { maxWidth: '900px', margin: '0 auto' }
  const cardStyle = { background: '#141414', border: '1px solid #232323', borderRadius: '8px', padding: '1.5rem', marginTop: '1.5rem' }
  const badgeStyle = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: connected ? '#3ecf8e' : '#f0576b' }
  const dotStyle = { width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#3ecf8e' : '#f0576b' }

  const latestPrice = points.length > 0 ? points[points.length - 1].price : null

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={{ color: 'white', fontSize: '1.6rem', fontWeight: 700 }}>PulseBoard</h1>
        <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.3rem' }}>Live BTC/USDT trades streamed directly from Binance, no polling from this browser.</p>

        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', alignItems: 'center' }}>
          <div style={badgeStyle}>
            <span style={dotStyle}></span>
            {connected ? 'Live' : 'Disconnected'}
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>{eventCount} events received this session</div>
        </div>

        {latestPrice !== null && (
          <div style={{ color: 'white', fontSize: '2rem', fontWeight: 700, marginTop: '1rem' }}>
            ${latestPrice.toLocaleString()}
          </div>
        )}

        <div style={cardStyle}>
          {points.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.9rem' }}>Waiting for the first live trade...</p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={points}>
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
