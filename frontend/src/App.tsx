import { useMemo, useState } from 'react'
import { Home } from './pages/Home'
import {
  alertLevelFromCustomers,
  type AlertLevel,
  type Customer,
  type StorefrontRuntimeConfig,
  type TheftFeedPayload,
} from './types'
import './App.css'

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

function readDemoTheftFlag(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('demo') === 'theft'
}

function App() {
  const [customers, setCustomers] = useState<Customer[]>(() =>
    readDemoTheftFlag() ? MOCK_CUSTOMERS_THEFT : MOCK_CUSTOMERS_IDLE,
  )

  const config: StorefrontRuntimeConfig = useMemo(
    () => ({
      emergencyTelHref: 'tel:911',
      riskThresholds: {
        elevated: 0.55,
        theft: 0.85,
      },
    }),
    [],
  )

  const alertLevel: AlertLevel = useMemo(
    () => alertLevelFromCustomers(customers, config.riskThresholds),
    [customers, config.riskThresholds],
  )

  const voiceApiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? '' : 'http://127.0.0.1:5001')

  const theftFeed: TheftFeedPayload = useMemo(() => {
    const worst = customers.reduce<Customer | null>(
      (best, c) => (!best || c.riskScore > best.riskScore ? c : best),
      null,
    )
    const inTheft = alertLevel === 'theft'
    return {
      videoSrc: inTheft ? null : null,
      posterSrc: null,
      customerId: inTheft && worst && worst.riskScore >= config.riskThresholds.theft
        ? worst.id
        : null,
    }
  }, [alertLevel, customers, config.riskThresholds])

  return (
    <div className="app-root">
      <Home
        customers={customers}
        config={config}
        alertLevel={alertLevel}
        theftFeed={theftFeed}
        voiceApiBaseUrl={voiceApiBaseUrl}
      />
      {import.meta.env.DEV ? (
        <div className="app-devrail">
          <span className="app-devrail__label">Dev</span>
          <button
            type="button"
            className="app-devrail__btn"
            onClick={() =>
              setCustomers((prev) =>
                prev.some((c) => c.riskScore >= config.riskThresholds.theft)
                  ? MOCK_CUSTOMERS_IDLE
                  : MOCK_CUSTOMERS_THEFT,
              )
            }
          >
            Toggle theft demo
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default App
