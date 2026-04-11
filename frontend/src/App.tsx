import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Home } from './pages/Home'
import { Evidence } from './pages/Evidence'
import {
  alertLevelFromCustomers,
  type AlertLevel,
  type Customer,
  type StorefrontRuntimeConfig,
  type TheftFeedPayload,
} from './types'
import './App.css'

type Page = 'live' | 'evidence'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5001'

const MOCK_CUSTOMERS_THEFT: Customer[] = [
  { id: 'person-1', description: 'PERSON 1', riskScore: 0.93 },
  { id: 'person-2', description: 'PERSON 2', riskScore: 0.08 },
]

function readDemoTheftFlag(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('demo') === 'theft'
}

function App() {
  const [page, setPage] = useState<Page>('live')
  const [customers, setCustomers] = useState<Customer[]>(() =>
    readDemoTheftFlag() ? MOCK_CUSTOMERS_THEFT : [],
  )
  const [hasLiveFrame, setHasLiveFrame] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const demoModeRef = useRef(readDemoTheftFlag())
  const [demoMode, setDemoMode] = useState(readDemoTheftFlag())
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  function boxColor(confidence: number): string {
    if (confidence >= 0.85) return '#f87171'  // red — high risk
    if (confidence >= 0.35) return '#fbbf24'  // amber — elevated
    return '#4ade80'                           // green — low
  }

  function drawFrame(
    canvas: HTMLCanvasElement,
    base64: string,
    predictions: { confidence: number; x: number; y: number; width: number; height: number }[],
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      for (const [i, p] of predictions.entries()) {
        const x = p.x - p.width / 2
        const y = p.y - p.height / 2
        const color = boxColor(p.confidence)
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.strokeRect(x, y, p.width, p.height)
        const label = `PERSON ${i + 1}  ${(p.confidence * 100).toFixed(0)}%`
        ctx.font = 'bold 14px monospace'
        const textW = ctx.measureText(label).width
        ctx.fillStyle = color
        ctx.fillRect(x, y - 20, textW + 8, 20)
        ctx.fillStyle = '#000'
        ctx.fillText(label, x + 4, y - 5)
      }
    }
    img.src = `data:image/jpeg;base64,${base64}`
  }

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('detection', (data: { predictions: { class: string; confidence: number; x: number; y: number; width: number; height: number }[]; alert: boolean; frame?: string }) => {
      if (demoModeRef.current) return

      if (data.predictions.length > 0) {
        setCustomers(data.predictions.map((p, i) => ({
          id: `person-${i + 1}`,
          description: `PERSON ${i + 1}`,
          riskScore: p.class === '1' ? p.confidence : 0.05,
        })))
      }

      if (data.frame) {
        if (canvasRef.current) {
          drawFrame(canvasRef.current, data.frame, data.predictions)
        }
        if (!hasLiveFrame) setHasLiveFrame(true)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [hasLiveFrame])

  const config: StorefrontRuntimeConfig = useMemo(
    () => ({
      emergencyTelHref: 'tel:911',
      riskThresholds: {
        elevated: 0.35,
        theft: 0.85,
      },
    }),
    [],
  )

  const alertLevel: AlertLevel = useMemo(
    () => alertLevelFromCustomers(customers, config.riskThresholds),
    [customers, config.riskThresholds],
  )

  const theftFeed: TheftFeedPayload = useMemo(() => {
    const worst = customers.reduce<Customer | null>(
      (best, c) => (!best || c.riskScore > best.riskScore ? c : best),
      null,
    )
    const inTheft = alertLevel === 'theft'
    return {
      videoSrc: hasLiveFrame ? 'live' : null,
      posterSrc: null,
      customerId: inTheft && worst && worst.riskScore >= config.riskThresholds.theft
        ? worst.id
        : null,
    }
  }, [alertLevel, customers, config.riskThresholds, hasLiveFrame])

  return (
    <div className="app-root">
      <nav className="app-nav">
        <button
          className={`app-nav__btn${page === 'live' ? ' app-nav__btn--active' : ''}`}
          onClick={() => setPage('live')}
        >
          Live
        </button>
        <button
          className={`app-nav__btn${page === 'evidence' ? ' app-nav__btn--active' : ''}`}
          onClick={() => setPage('evidence')}
        >
          Evidence
        </button>
      </nav>

      {page === 'live' ? (
        <Home
          customers={customers}
          config={config}
          alertLevel={alertLevel}
          theftFeed={theftFeed}
          canvasRef={canvasRef}
        />
      ) : (
        <Evidence />
      )}

      {import.meta.env.DEV ? (
        <div className="app-devrail">
          <span className="app-devrail__label">Dev</span>
          <button
            type="button"
            className="app-devrail__btn"
            onClick={() => {
              const nextDemo = !demoModeRef.current
              demoModeRef.current = nextDemo
              setDemoMode(nextDemo)
              setCustomers(nextDemo ? MOCK_CUSTOMERS_THEFT : [])
            }}
          >
            {demoMode ? 'Exit demo' : 'Toggle theft demo'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default App
