/** Risk bands for UI coloring; align with backend alert policy. */
export interface RiskThresholds {
  /** At or above: elevated / watch (amber). */
  elevated: number
  /** At or above: high / theft layout + styling (red). */
  theft: number
}

export type RiskTone = 'low' | 'elevated' | 'high'

export interface Customer {
  id: string
  /** Human-readable identifier from vision model (e.g. clothing). */
  description: string
  /** 0–1 normalized risk; backend may use a different scale—map before passing. */
  riskScore: number
}

export type AlertLevel = 'none' | 'watch' | 'theft'

export interface TheftFeedPayload {
  /** Stream URL, clip URL, or WebSocket-backed blob URL from backend. */
  videoSrc: string | null
  posterSrc?: string | null
  /** Customer id this feed is focused on. */
  customerId: string | null
}

/** Values the backend (or env) will eventually own; kept in one shape for wiring. */
export interface StorefrontRuntimeConfig {
  emergencyTelHref: string
  riskThresholds: RiskThresholds
}

export function riskTone(score: number, t: RiskThresholds): RiskTone {
  if (score >= t.theft) return 'high'
  if (score >= t.elevated) return 'elevated'
  return 'low'
}

export function alertLevelFromCustomers(
  customers: Customer[],
  t: RiskThresholds,
): AlertLevel {
  const max = customers.reduce((m, c) => Math.max(m, c.riskScore), 0)
  if (max >= t.theft) return 'theft'
  if (max >= t.elevated) return 'watch'
  return 'none'
}
