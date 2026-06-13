import { useEffect, useState } from 'react'
import { EmergencyCallButton } from '../components/EmergencyCallButton'
import './Evidence.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5001'

interface Incident {
  id: number
  timestamp: string
  confidence: number
  folder: string
}

interface IncidentDetail {
  incident: Incident
  frames: string[]
}

interface EvidenceProps {
  onEmergencyIntent?: () => void
}

export function Evidence({ onEmergencyIntent }: EvidenceProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selected, setSelected] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(incidents.length / PAGE_SIZE)
  const pageIncidents = incidents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    fetch(`${BACKEND_URL}/evidence`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(r => r.json())
      .then(setIncidents)
      .catch(() => {})
  }, [])

  function loadIncident(id: number) {
    setLoading(true)
    fetch(`${BACKEND_URL}/evidence/${id}/frames`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(r => r.json())
      .then((data: IncidentDetail) => {
        setSelected(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function deleteIncident(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    fetch(`${BACKEND_URL}/evidence/${id}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    }).then(() => {
      setIncidents(prev => prev.filter(inc => inc.id !== id))
      if (selected?.incident.id === id) setSelected(null)
    }).catch(() => {})
  }

  function confidenceColor(c: number) {
    if (c >= 0.75) return '#f87171'
    if (c >= 0.50) return '#fbbf24'
    return '#4ade80'
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

      <div className="evidence-body">
        <aside className="evidence-list">
          {incidents.length === 0 ? (
            <p className="evidence-empty">No incidents recorded yet.</p>
          ) : (
            <>
              <div className="evidence-list__items">
                {pageIncidents.map(inc => (
                  <div
                    key={inc.id}
                    className={`evidence-item${selected?.incident.id === inc.id ? ' evidence-item--active' : ''}`}
                    onClick={() => loadIncident(inc.id)}
                  >
                    <span className="evidence-item__time">{inc.timestamp.replace('_', ' ').replace(/-/g, ':')}</span>
                    <span
                      className="evidence-item__conf"
                      style={{ color: confidenceColor(inc.confidence) }}
                    >
                      {(inc.confidence * 100).toFixed(0)}%
                    </span>
                    <button
                      className="evidence-item__delete"
                      onClick={(e) => deleteIncident(e, inc.id)}
                      title="Delete"
                    >✕</button>
                  </div>
                ))}
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
        </aside>

        <main className="evidence-frames">
          {loading && <p className="evidence-empty">Loading frames...</p>}
          {!loading && !selected && (
            <p className="evidence-empty">Select an incident to view frames.</p>
          )}
          {!loading && selected && (
            <>
              <p className="evidence-frames__label">
                {selected.incident.timestamp.replace('_', ' ')} —{' '}
                <span style={{ color: confidenceColor(selected.incident.confidence) }}>
                  {(selected.incident.confidence * 100).toFixed(0)}% confidence
                </span>
              </p>
              <div className="evidence-filmstrip">
                {selected.frames.map((f, i) => (
                  <img
                    key={i}
                    className="evidence-frame"
                    src={f}
                    alt={`Frame ${i + 1}`}
                    onClick={() => setLightbox(f)}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
      {lightbox && (
        <div className="evidence-lightbox" onClick={() => setLightbox(null)}>
          <img className="evidence-lightbox__img" src={lightbox} alt="Zoomed frame" />
        </div>
      )}
    </div>
  )
}
