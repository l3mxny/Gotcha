import type { Customer } from './types'

export type RawPrediction = {
  class: string
  confidence: number
  x?: number
  y?: number
}

/** Roboflow may return 0–1 or 0–100 depending on endpoint. */
export function normalizeModelConfidence(c: number): number {
  if (!Number.isFinite(c)) return 0
  if (c > 1) return Math.min(1, c / 100)
  return Math.min(1, Math.max(0, c))
}

export function formatDetectionClass(cls: string): string {
  return String(cls)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/** Prefer bbox so two instances of the same class keep separate rows. */
function stableDetectionId(p: RawPrediction, index: number): string {
  if (p.x != null && p.y != null) {
    const qx = Math.round(p.x / 24)
    const qy = Math.round(p.y / 24)
    return `det-${encodeURIComponent(String(p.class))}-${qx}-${qy}`
  }
  return `det-${index}-${encodeURIComponent(String(p.class))}`
}

export function mapPredictionsToCustomers(predictions: RawPrediction[]): Customer[] {
  return [...predictions]
    .map((p, i) => ({
      id: stableDetectionId(p, i),
      description: formatDetectionClass(p.class),
      riskScore: normalizeModelConfidence(p.confidence),
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
}
