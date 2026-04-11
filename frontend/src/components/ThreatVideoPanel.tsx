import { type CSSProperties, type RefObject } from 'react'

export interface ThreatVideoPanelProps {
  videoSrc: string | null
  posterSrc?: string | null
  customerLabel?: string | null
  canvasRef: RefObject<HTMLCanvasElement | null>
  className?: string
  style?: CSSProperties
}

export function ThreatVideoPanel({
  videoSrc,
  customerLabel,
  canvasRef,
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
        <canvas
          ref={canvasRef}
          className="threat-video__media"
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
