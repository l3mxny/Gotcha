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
import { mapPredictionsToCustomers, type RawPrediction } from './mapPredictionsToCustomers'
import './App.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5001'

/** Placeholder rows until the model streams real descriptors and scores. */
const MOCK_CUSTOMERS_IDLE: Customer[] = [
  { id: 'c1', description: 'BLUE HAT', riskScore: 0.11 },
  { id: 'c2', description: 'YELLOW SHIRT', riskScore: 0.08 },
  { id: 'c3', description: 'RED JACKET', riskScore: 0.14 },
  { id: 'c4', description: 'WHITE SHOES', riskScore: 0.09 },
  { id: 'c5', description: 'BLACK BACKPACK', riskScore: 0.12 },
]

const MOCK_CUSTOMERS_THEFT: Customer[] = MOCK_CUSTOMERS_IDLE.map((c) =>
  c.id === 'c2'
    ? { ...c, riskScore: 0.93, description: 'YELLOW SHIRT' }
    : c,
)

/** Several distinct “people” for UI / pitch testing without a live model. */
const MOCK_CUSTOMERS_MULTI: Customer[] = [
  { id: 'm1', description: 'GRAY SWEATSHIRT · ENTRANCE', riskScore: 0.18 },
  { id: 'm2', description: 'STRIPED BAG · AISLE 3', riskScore: 0.41 },
  { id: 'm3', description: 'RED CAP · CHECKOUT', riskScore: 0.27 },
  { id: 'm4', description: 'DENIM JACKET · DAIRY', riskScore: 0.15 },
  { id: 'm5', description: 'KIDS STROLLER · FRONT', riskScore: 0.09 },
]

export type DemoPreset = 'none' | 'theft' | 'multi'

function readInitialDemoPreset(): DemoPreset {
  if (typeof window === 'undefined') return 'none'
  const v = new URLSearchParams(window.location.search).get('demo')
  if (v === 'theft') return 'theft'
  if (v === 'multi') return 'multi'
  return 'none'
}

function customersForDemoPreset(p: DemoPreset): Customer[] {
  if (p === 'theft') return MOCK_CUSTOMERS_THEFT
  if (p === 'multi') return MOCK_CUSTOMERS_MULTI
  return MOCK_CUSTOMERS_IDLE
}

function App() {
  const initialPreset = readInitialDemoPreset()
  const [customers, setCustomers] = useState<Customer[]>(() =>
    customersForDemoPreset(initialPreset),
  )
  const [hasLiveFrame, setHasLiveFrame] = useState(false)
  const frameImgRef = useRef<HTMLImageElement | null>(null)
  const demoPresetRef = useRef<DemoPreset>(initialPreset)
  const [demoPreset, setDemoPreset] = useState<DemoPreset>(initialPreset)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on(
      'detection',
      (data: {
        predictions: RawPrediction[]
        alert: boolean
        frame?: string
      }) => {
        // Watchlist is frozen while a demo preset is on; frames still stream
        // so theft demo can show real phone / camera footage.
        if (demoPresetRef.current === 'none') {
          const preds = data.predictions ?? []
          if (preds.length > 0) {
            setCustomers(mapPredictionsToCustomers(preds))
          }
        }

        if (data.frame) {
          if (frameImgRef.current) {
            frameImgRef.current.src = `data:image/jpeg;base64,${data.frame}`
          }
          setHasLiveFrame(true)
        }
      },
    )

    return () => {
      socket.disconnect()
    }
  }, [])

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
              const next: DemoPreset = demoPresetRef.current === 'theft' ? 'none' : 'theft'
              demoPresetRef.current = next
              setDemoPreset(next)
              setCustomers(customersForDemoPreset(next))
            }}
          >
            {demoPreset === 'theft' ? 'Exit theft demo' : 'Theft demo'}
          </button>
          <button
            type="button"
            className="app-devrail__btn"
            onClick={() => {
              const next: DemoPreset = demoPresetRef.current === 'multi' ? 'none' : 'multi'
              demoPresetRef.current = next
              setDemoPreset(next)
              setCustomers(customersForDemoPreset(next))
            }}
          >
            {demoPreset === 'multi' ? 'Exit multi demo' : 'Multi scan demo'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default App
