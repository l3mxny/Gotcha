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

  return (
    <div className={`home-shell${videoActive ? ' home-shell--theft' : ''}`}>
      <header className="home-top">
        <h1 className="home-brand">Customer watchlist</h1>
        {theftActive ? (
          <EmergencyCallButton
            className="eg-call eg-call--header"
            telHref={config.emergencyTelHref}
            onCallIntent={onEmergencyIntent}
          />
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
