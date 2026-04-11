import { EmergencyCallButton } from '../components/EmergencyCallButton'
import { CustomerWatchlist } from '../components/CustomerWatchlist'
import { ThreatVideoPanel } from '../components/ThreatVideoPanel'
import { useVoice911Call } from '../hooks/useVoice911Call'
import type {
  AlertLevel,
  Customer,
  StorefrontRuntimeConfig,
  TheftFeedPayload,
} from '../types'
import './Home.css'

export interface HomeProps {
  customers: Customer[]
  config: StorefrontRuntimeConfig
  alertLevel: AlertLevel
  theftFeed: TheftFeedPayload
  /** Base URL for Flask (e.g. http://127.0.0.1:5001). */
  voiceApiBaseUrl: string
  /** Optional handler when emergency link is used (logging, etc.). */
  onEmergencyIntent?: () => void
}

export function Home({
  customers,
  config,
  alertLevel,
  theftFeed,
  voiceApiBaseUrl,
  onEmergencyIntent,
}: HomeProps) {
  const theftActive = alertLevel === 'theft'

  const focused = theftFeed.customerId
    ? customers.find((c) => c.id === theftFeed.customerId)
    : customers.reduce<Customer | undefined>((best, c) => {
        if (!best || c.riskScore > best.riskScore) return c
        return best
      }, undefined)

  const focusDescription = focused?.description ?? null

  const voice911 = useVoice911Call(voiceApiBaseUrl)

  return (
    <div className={`home-shell${theftActive ? ' home-shell--theft' : ''}`}>
      <header className="home-top">
        <h1 className="home-brand">Customer watchlist</h1>
        {theftActive ? (
          <div className="home-call">
            <EmergencyCallButton
              variant="voice"
              className="eg-call eg-call--header"
              label="Call 911"
              disabled={voice911.busy}
              onVoiceClick={() =>
                voice911.startVoiceCall(
                  focusDescription
                    ? `Theft alert. Focused customer descriptor: ${focusDescription}.`
                    : 'Theft alert at the storefront.',
                )
              }
              onCallIntent={onEmergencyIntent}
            />
            {voice911.phaseLabel ? (
              <span className="home-call__status" aria-live="polite">
                {voice911.phaseLabel}
              </span>
            ) : null}
            {voice911.errorMessage ? (
              <span className="home-call__err" role="alert">
                {voice911.errorMessage}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="home-top__spacer" aria-hidden />
        )}
      </header>

      <div className="home-grid">
        <div className="home-grid__list">
          <CustomerWatchlist
            customers={customers}
            thresholds={config.riskThresholds}
            compact={theftActive}
          />
        </div>
        <div
          className={`home-grid__video${theftActive ? ' home-grid__video--visible' : ''}`}
          aria-hidden={!theftActive}
        >
          {theftActive ? (
            <ThreatVideoPanel
              videoSrc={theftFeed.videoSrc}
              posterSrc={theftFeed.posterSrc}
              customerLabel={focusDescription}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
