import { Device, type Call } from '@twilio/voice-sdk'

let sharedDevice: Device | null = null

function assertVoiceSupported(): void {
  if (!Device.isSupported) {
    throw new Error('Twilio Voice is not supported in this browser.')
  }
}

/**
 * Registers or reuses a single {@link Device}, refreshes the JWT, then starts an outbound call.
 * Custom `params` are POSTed to your TwiML App webhook as form fields.
 */
export async function connectOutboundVoiceCall(options: {
  token: string
  callSessionId: string
}): Promise<{ device: Device; call: Call }> {
  assertVoiceSupported()
  const { token, callSessionId } = options

  if (!sharedDevice) {
    sharedDevice = new Device(token, {
      logLevel: 'error',
    })
    sharedDevice.on('error', (err) => {
      console.error('[Twilio Device]', err)
    })
    await sharedDevice.register()
  } else {
    sharedDevice.updateToken(token)
    if (sharedDevice.state !== 'registered') {
      await sharedDevice.register()
    }
  }

  const call = await sharedDevice.connect({
    params: { callSessionId },
  })

  return { device: sharedDevice, call }
}

export function destroySharedVoiceDevice(): void {
  try {
    sharedDevice?.destroy()
  } finally {
    sharedDevice = null
  }
}
