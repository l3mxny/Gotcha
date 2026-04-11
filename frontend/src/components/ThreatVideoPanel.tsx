import type { CSSProperties } from 'react'

export interface ThreatVideoPanelProps {
  /** When null, shows a neutral placeholder until backend attaches a feed. */
  videoSrc: string | null
  posterSrc?: string | null
  customerLabel?: string | null
  className?: string
  style?: CSSProperties
}

export function ThreatVideoPanel({
  videoSrc,
  posterSrc,
  customerLabel,
  className,
  style,
}: ThreatVideoPanelProps) {
  return (
    <div
      className={`threat-video${className ? ` ${className}` : ''}`}
      style={style}
      role="region"
      aria-label={
        customerLabel
          ? `Live feed focused on ${customerLabel}`
          : 'Theft alert video feed'
      }
    >
      {videoSrc ? (
        <video
          className="threat-video__media"
          src={videoSrc}
          poster={posterSrc ?? undefined}
          controls
          playsInline
          autoPlay
          muted
        />
      ) : (
        <div className="threat-video__placeholder">
          <span className="threat-video__placeholder-label">
            CCTV / clip feed
          </span>
          <span className="threat-video__placeholder-hint">
            Backend will set <code>videoSrc</code>
          </span>
        </div>
      )}
    </div>
  )
}
