import type { CSSProperties } from 'react'

export interface EmergencyCallButtonProps {
  /** E.g. `tel:911` when using the tel link variant. */
  telHref?: string
  label?: string
  className?: string
  style?: CSSProperties
  /** `tel` keeps the original anchor behavior; `voice` uses a button + Twilio flow. */
  variant?: 'tel' | 'voice'
  disabled?: boolean
  onVoiceClick?: () => void
  /** Reserved for analytics when using tel variant. */
  onCallIntent?: () => void
}

export function EmergencyCallButton({
  telHref = 'tel:911',
  label = 'Call 911',
  className,
  style,
  variant = 'tel',
  disabled = false,
  onVoiceClick,
  onCallIntent,
}: EmergencyCallButtonProps) {
  if (variant === 'voice') {
    return (
      <button
        type="button"
        className={className}
        style={style}
        disabled={disabled}
        onClick={() => onVoiceClick?.()}
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
      </button>
    )
  }

  return (
    <a
      className={className}
      style={style}
      href={telHref}
      role="button"
      onClick={() => onCallIntent?.()}
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
