import { useCallback, useRef, useState } from 'react'
import type { Call } from '@twilio/voice-sdk'
import {
  formatApiFailure,
  getTwilioVoiceToken,
  postCall911Start,
  type VoiceApiErrorShape,
} from '../lib/call911Api'
import { connectOutboundVoiceCall } from '../lib/twilioVoice'

export type Voice911Phase =
  | 'idle'
  | 'preparing'
  | 'calling'
  | 'playing'
  | 'done'
  | 'error'

function phaseLabel(phase: Voice911Phase): string {
  switch (phase) {
    case 'idle':
      return ''
    case 'preparing':
      return 'Preparing…'
    case 'calling':
      return 'Calling…'
    case 'playing':
      return 'Playing message…'
    case 'done':
      return 'Done'
    case 'error':
      return 'Error'
    default:
      return ''
  }
}

function attachCallListeners(
  call: Call,
  setPhase: (p: Voice911Phase) => void,
  setErrorMessage: (m: string | null) => void,
  releaseInFlight: () => void,
): void {
  const done = () => releaseInFlight()

  call.on('ringing', () => setPhase('calling'))
  call.on('accept', () => setPhase('playing'))
  call.on('disconnect', () => {
    setPhase('done')
    done()
  })
  call.on('cancel', () => {
    setPhase('done')
    done()
  })
  call.on('reject', () => {
    setPhase('error')
    setErrorMessage('Call was rejected or could not complete.')
    done()
  })
  call.on('error', (twilioErr) => {
    setPhase('error')
    const msg =
      twilioErr && typeof twilioErr === 'object' && 'message' in twilioErr
        ? String((twilioErr as { message?: string }).message)
        : 'Call error'
    setErrorMessage(msg)
    done()
  })
}

export function useVoice911Call(apiBaseUrl: string) {
  const [phase, setPhase] = useState<Voice911Phase>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const busy = phase === 'preparing' || phase === 'calling' || phase === 'playing'

  const startVoiceCall = useCallback(
    async (theftContext?: string | null) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setErrorMessage(null)
      setPhase('preparing')
      try {
        const start = await postCall911Start(apiBaseUrl, theftContext)
        if (!start.ok) {
          throw new Error(
            formatApiFailure('Prepare', start as unknown as VoiceApiErrorShape),
          )
        }

        setPhase('calling')
        const tokenRes = await getTwilioVoiceToken(apiBaseUrl)
        if (!tokenRes.ok) {
          throw new Error(
            formatApiFailure('Token', tokenRes as unknown as VoiceApiErrorShape),
          )
        }
        if (!tokenRes.token) {
          throw new Error('Token step failed')
        }

        const { call } = await connectOutboundVoiceCall({
          token: tokenRes.token,
          callSessionId: start.callSessionId,
        })

        attachCallListeners(call, setPhase, setErrorMessage, () => {
          inFlightRef.current = false
        })
      } catch (e) {
        inFlightRef.current = false
        setPhase('error')
        setErrorMessage(e instanceof Error ? e.message : String(e))
      }
    },
    [apiBaseUrl],
  )

  return {
    phase,
    phaseLabel: phaseLabel(phase),
    errorMessage,
    busy,
    startVoiceCall,
  }
}
