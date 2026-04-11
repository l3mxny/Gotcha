import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Home } from './pages/Home'
import {
  alertLevelFromCustomers,
  type AlertLevel,
  type Customer,
  type StorefrontRuntimeConfig,
  type TheftFeedPayload,
} from './types'
import './App.css'

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
  const [customers, setCustomers] = useState<Customer[]>(() =>
    readDemoTheftFlag() ? MOCK_CUSTOMERS_THEFT : [],
  )
  const [hasLiveFrame, setHasLiveFrame] = useState(false)
  const frameImgRef = useRef<HTMLImageElement | null>(null)
  const demoModeRef = useRef(readDemoTheftFlag())
  const [demoMode, setDemoMode] = useState(readDemoTheftFlag())
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('detection', (data: { predictions: { class: string; confidence: number }[]; alert: boolean; frame?: string }) => {
      if (demoModeRef.current) return

      if (data.predictions.length > 0) {
        console.log('predictions:', data.predictions)
        setCustomers(data.predictions.map((p, i) => ({
          id: `person-${i + 1}`,
          description: `PERSON ${i + 1}`,
          riskScore: p.confidence,
        })))
      }

      // update img DOM directly — no React state, no re-render lag
      if (data.frame) {
        if (frameImgRef.current) {
          frameImgRef.current.src = `data:image/jpeg;base64,${data.frame}`
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
      <Home
        customers={customers}
        config={config}
        alertLevel={alertLevel}
        theftFeed={theftFeed}
        frameImgRef={frameImgRef}
      />
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
