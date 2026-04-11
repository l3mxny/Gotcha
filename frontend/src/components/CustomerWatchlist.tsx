import type { Customer, RiskThresholds } from '../types'
import { riskTone } from '../types'

export interface CustomerWatchlistProps {
  customers: Customer[]
  thresholds: RiskThresholds
  /** Tighter layout when theft layout is active. */
  compact?: boolean
}

function toneClass(tone: ReturnType<typeof riskTone>): string {
  if (tone === 'high') return 'cw-risk cw-risk--high'
  if (tone === 'elevated') return 'cw-risk cw-risk--elevated'
  return 'cw-risk cw-risk--low'
}

export function CustomerWatchlist({
  customers,
  thresholds,
  compact,
}: CustomerWatchlistProps) {
  return (
    <section
      className={`customer-watchlist${compact ? ' customer-watchlist--compact' : ''}`}
      aria-label="Customer watchlist"
    >
      <div className="cw-table-wrap">
        <table className="cw-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Description</th>
              <th scope="col">Risk score</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const tone = riskTone(c.riskScore, thresholds)
              return (
                <tr key={c.id}>
                  <td className="cw-num">{i + 1}</td>
                  <td className="cw-desc">{c.description}</td>
                  <td>
                    <span className={toneClass(tone)}>
                      <span className="cw-bar" aria-hidden />
                      <span className="cw-val">
                        {c.riskScore.toFixed(2)}
                      </span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <nav className="cw-pager" aria-label="Watchlist pages">
        <button type="button" className="cw-pager__btn" disabled aria-hidden>
          ‹
        </button>
        <span className="cw-pager__dots">· · ·</span>
        <button type="button" className="cw-pager__btn" disabled aria-hidden>
          ›
        </button>
      </nav>
    </section>
  )
}
