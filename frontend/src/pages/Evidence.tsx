import { useEffect, useState } from 'react'
import { EmergencyCallButton } from '../components/EmergencyCallButton'
import './Evidence.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5001'

interface Incident {
  id: number
  timestamp: string
  confidence: number
  folder: string
  frame_urls: string[]
  description?: string | null
}

interface EvidenceProps {
  onEmergencyIntent?: () => void
}

function formatTimestamp(ts: string) {
  const [date, time] = ts.split('_')
  return { date: date ?? '', time: (time ?? '').replace(/-/g, ':') }
}

function confidenceColor(c: number) {
  if (c >= 0.75) return '#f87171'
  if (c >= 0.50) return '#fbbf24'
  return '#4ade80'
}

export function Evidence({ onEmergencyIntent }: EvidenceProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [modal, setModal] = useState<Incident | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 12
  const totalPages = Math.ceil(incidents.length / PAGE_SIZE)
  const pageIncidents = incidents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    fetch(`${BACKEND_URL}/evidence`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(r => r.json())
      .then(setIncidents)
      .catch(() => {})
  }, [])

  function deleteIncident(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    fetch(`${BACKEND_URL}/evidence/${id}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    }).then(() => {
      setIncidents(prev => prev.filter(inc => inc.id !== id))
      if (modal?.id === id) setModal(null)
    }).catch(() => {})
  }

  return (
    <div className="evidence-shell">
      <header className="evidence-header">
        <div className="evidence-header__left">
          <h1 className="evidence-title">Evidence Log</h1>
          <span className="evidence-badge">{incidents.length}</span>
        </div>
        <EmergencyCallButton
          className="eg-call eg-call--header"
          telHref="#"
          onCallIntent={onEmergencyIntent}
        />
      </header>

      <div className="evidence-scroll">
        {incidents.length === 0 ? (
          <p className="evidence-empty">No incidents recorded yet.</p>
        ) : (
          <>
            <div className="evidence-grid">
              {pageIncidents.map(inc => {
                const { date, time } = formatTimestamp(inc.timestamp)
                const thumbnail = inc.frame_urls?.[0]
                return (
                  <div key={inc.id} className="ev-card" onClick={() => setModal(inc)}>
                    <div className="ev-card__img-wrap">
                      {thumbnail
                        ? <img className="ev-card__img" src={thumbnail} alt="frame" />
                        : <div className="ev-card__img ev-card__img--empty" />
                      }
                    </div>
                    <div className="ev-card__footer">
                      <span className="ev-card__date">{date}</span>
                      <span className="ev-card__time">{time}</span>
                      <div className="ev-card__bottom">
                        <span className="ev-card__conf" style={{ color: confidenceColor(inc.confidence) }}>
                          {(inc.confidence * 100).toFixed(0)}% confidence
                        </span>
                        <button className="ev-card__delete-btn" onClick={e => deleteIncident(e, inc.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="evidence-pager">
                <button
                  className="evidence-pager__btn"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >&#8592;</button>
                <span className="evidence-pager__info">{page + 1} / {totalPages}</span>
                <button
                  className="evidence-pager__btn"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                >&#8594;</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Frame modal */}
      {modal && (
        <div className="ev-modal-overlay" onClick={() => setModal(null)}>
          <div className="ev-modal" onClick={e => e.stopPropagation()}>
            <div className="ev-modal__header">
              <div className="ev-modal__meta">
                <span className="ev-modal__time">{formatTimestamp(modal.timestamp).date} {formatTimestamp(modal.timestamp).time}</span>
                <span className="ev-modal__conf" style={{ color: confidenceColor(modal.confidence) }}>
                  {(modal.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
              <div className="ev-modal__actions">
                <button className="ev-modal__delete" onClick={e => deleteIncident(e, modal.id)}>Delete</button>
                <button className="ev-modal__close" onClick={() => setModal(null)}>✕</button>
              </div>
            </div>
            {modal.description && (
              <p className="ev-modal__desc">{modal.description}</p>
            )}
            <div className="ev-modal__frames">
              {modal.frame_urls.map((url, i) => (
                <img
                  key={i}
                  className="ev-modal__frame"
                  src={url}
                  alt={`Frame ${i + 1}`}
                  onClick={() => setLightbox(url)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="evidence-lightbox" onClick={() => setLightbox(null)}>
          <img className="evidence-lightbox__img" src={lightbox} alt="Zoomed" />
        </div>
      )}
    </div>
  )
}
