import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
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

export function Evidence() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selected, setSelected] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(false)

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

  function confidenceColor(c: number) {
    if (c >= 0.85) return '#f87171'
    if (c >= 0.35) return '#fbbf24'
    return '#4ade80'
  }

  return (
    <div className="evidence-shell">
      <header className="evidence-header">
        <h1 className="evidence-title">Evidence Log</h1>
        <span className="evidence-count">{incidents.length} incident{incidents.length !== 1 ? 's' : ''}</span>
      </header>

      <div className="evidence-body">
        <aside className="evidence-list">
          {incidents.length === 0 ? (
            <p className="evidence-empty">No incidents recorded yet.</p>
          ) : (
            incidents.map(inc => (
              <button
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
              </button>
            ))
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
                    src={`data:image/jpeg;base64,${f}`}
                    alt={`Frame ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
