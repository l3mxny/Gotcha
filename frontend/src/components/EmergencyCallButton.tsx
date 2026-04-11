import type { CSSProperties } from 'react'

export interface EmergencyCallButtonProps {
  /** E.g. `tel:911` or `tel:+15551234567` from backend/config. */
  telHref: string
  label?: string
  className?: string
  style?: CSSProperties
  /** Reserved for analytics or backend acknowledgment hooks. */
  onCallIntent?: () => void
}

export function EmergencyCallButton({
  telHref,
  label = 'ALERT SECURITY', // Changed label to fit the actual action
  className,
  style,
  onCallIntent,
}: EmergencyCallButtonProps) {
  return (
    <a
      className={className}
      style={style}
      href={telHref}
      role="button"
      onClick={(e) => {
        e.preventDefault(); // Stop the '#' from jumping the page to the top
        onCallIntent?.();
      }}
    >
      <span className="eg-call__icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span>{label}</span>
    </a>
  )
}