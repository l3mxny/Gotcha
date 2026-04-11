import { type CSSProperties, type RefObject } from 'react'

export interface ThreatVideoPanelProps {
  /** When null, shows a neutral placeholder until backend attaches a feed. */
  videoSrc: string | null
  posterSrc?: string | null
  customerLabel?: string | null
  frameImgRef: RefObject<HTMLImageElement | null>
  className?: string
  style?: CSSProperties
}

export function ThreatVideoPanel({
  videoSrc,
  customerLabel,
  frameImgRef,
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
        <img
          ref={frameImgRef}
          className="threat-video__media"
          alt={customerLabel ? `Live feed: ${customerLabel}` : 'Live feed'}
        />
      ) : (
        <div className="threat-video__placeholder">
          <div className="threat-video__placeholder-scan" aria-hidden />
          <div className="threat-video__placeholder-core">
            <div className="threat-video__placeholder-ring" aria-hidden />
            <svg
              className="threat-video__placeholder-icon"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="threat-video__placeholder-label">
              CCTV / clip feed
            </span>
            <span className="threat-video__placeholder-hint">
              Waiting for encoded frames from the edge device…
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
