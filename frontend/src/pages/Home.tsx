import { type RefObject } from 'react'
import { EmergencyCallButton } from '../components/EmergencyCallButton'
import { CustomerWatchlist } from '../components/CustomerWatchlist'
import { ThreatVideoPanel } from '../components/ThreatVideoPanel'
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
  frameImgRef: RefObject<HTMLImageElement | null>
  /** Optional handler when emergency link is used (logging, etc.). */
  onEmergencyIntent?: () => void
}

export function Home({
  customers,
  config,
  alertLevel,
  theftFeed,
  frameImgRef,
  onEmergencyIntent,
}: HomeProps) {
  const theftActive = alertLevel === 'theft'
  const videoActive = theftActive || !!theftFeed.videoSrc

  const focused = theftFeed.customerId
    ? customers.find((c) => c.id === theftFeed.customerId)
    : customers.reduce<Customer | undefined>((best, c) => {
        if (!best || c.riskScore > best.riskScore) return c
        return best
      }, undefined)

  const focusDescription = focused?.description ?? null

  const statusLabel =
    alertLevel === 'theft'
      ? 'Theft alert'
      : alertLevel === 'watch'
        ? 'Elevated risk'
        : 'Standby'

  return (
    <div
      className={`home-shell home-shell--alert-${alertLevel}${videoActive ? ' home-shell--video-open' : ''}`}
    >
      <header className="home-top">
        <div className="home-top__brandblock">
          <span className="home-top__mark" aria-hidden />
          <div className="home-top__titles">
            <h1 className="home-brand">Customer watchlist</h1>
            <p className="home-tagline">Vision-linked risk board</p>
          </div>
        </div>
        <div className="home-top__actions">
          <span
            className={`home-status home-status--${alertLevel}`}
            role="status"
            aria-live="polite"
          >
            <span className="home-status__dot" aria-hidden />
            {statusLabel}
          </span>
          {theftActive ? (
            <EmergencyCallButton
              className="eg-call eg-call--header eg-call--pulse"
              telHref={config.emergencyTelHref}
              onCallIntent={onEmergencyIntent}
            />
          ) : null}
        </div>
      </header>

      <div className="home-grid">
        <div className="home-grid__list">
          <CustomerWatchlist
            customers={customers}
            thresholds={config.riskThresholds}
            compact={theftActive}
            highlightCustomerId={theftFeed.customerId}
          />
        </div>
        <div
          className={`home-grid__video${videoActive ? ' home-grid__video--visible' : ''}`}
          aria-hidden={!videoActive}
        >
          {videoActive ? (
            <ThreatVideoPanel
              videoSrc={theftFeed.videoSrc}
              posterSrc={theftFeed.posterSrc}
              customerLabel={focusDescription}
              frameImgRef={frameImgRef}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
