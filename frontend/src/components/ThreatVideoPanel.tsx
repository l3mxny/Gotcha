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
          <span className="threat-video__placeholder-label">
            CCTV / clip feed
          </span>
          <span className="threat-video__placeholder-hint">
            Waiting for camera feed...
          </span>
        </div>
      )}
    </div>
  )
}
