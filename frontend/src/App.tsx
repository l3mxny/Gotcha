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
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  function boxColor(risk: number): string {
    if (risk >= 0.80) return '#f87171'   // red — 80-100%
    if (risk >= 0.50) return '#fbbf24'   // yellow — 50-79%
    return '#4ade80'                      // green — 0-49%
  }

  function riskScore(p: { class: string; confidence: number }): number {
    return p.class === '1' ? p.confidence : 1 - p.confidence
  }

  function drawFrame(
    canvas: HTMLCanvasElement,
    base64: string,
    predictions: { class: string; confidence: number; x: number; y: number; width: number; height: number }[],
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      for (const p of predictions) {
        const x = p.x - p.width / 2
        const y = p.y - p.height / 2
        const risk = riskScore(p)
        const color = boxColor(risk)
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.strokeRect(x, y, p.width, p.height)
        ctx.fillStyle = color
        ctx.font = 'bold 14px monospace'
        ctx.fillText(`${(p.confidence * 100).toFixed(0)}%`, x + 4, y - 6)
      }
    }
    img.src = `data:image/jpeg;base64,${base64}`
  }

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    })
    socketRef.current = socket

    socket.on('detection', (data: { predictions: { class: string; confidence: number; x: number; y: number; width: number; height: number }[]; alert: boolean; frame?: string }) => {
      if (demoModeRef.current) return

      if (data.predictions.length > 0) {
        setCustomers(data.predictions.map((p, i) => ({
          id: `person-${i + 1}`,
          description: `PERSON ${i + 1}`,
          riskScore: p.confidence,
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

  // NEW FUNCTION: Handles calling the backend to trigger the AI Call
  const handleEmergencyIntent = async () => {
    const worstCustomer = customers.reduce<Customer | null>(
      (best, c) => (!best || c.riskScore > best.riskScore ? c : best),
      null,
    );

    const description = worstCustomer?.description || "Unknown suspect";

    try {
      const res = await fetch(`${BACKEND_URL}/trigger-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ description }),
      });
      
      if (res.ok) {
        console.log("Automated security call initiated!");
      } else {
        console.error("Failed to trigger call");
      }
    } catch (error) {
      console.error("Error triggering call:", error);
    }
  };

  const config: StorefrontRuntimeConfig = useMemo(
    () => ({
      emergencyTelHref: '#', // Changed to prevent opening native phone dialer
      riskThresholds: {
        elevated: 0.50,
        theft: 0.80,
      },
    }),
    [],
  )

  const alertLevel: AlertLevel = useMemo(
    () => alertLevelFromCustomers(customers, config.riskThresholds),
    [customers, config.riskThresholds],
  )

  const voiceApiBaseUrl =
    import.meta.env.VITE_BACKEND_URL ??
    (import.meta.env.DEV ? '' : 'http://127.0.0.1:5001')

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
  onEmergencyIntent={handleEmergencyIntent}
/>
      ) : (
        <Evidence />
      )}

    </div>
  )
}

export default App