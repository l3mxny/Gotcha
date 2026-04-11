const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

export interface Call911StartResponseOk {
  ok: true
  callSessionId: string
  audioUrl: string
}

export interface Call911StartResponseErr {
  ok: false
  error?: string
  message?: string
  missingEnv?: string[]
  hints?: string[]
}

export type Call911StartResponse = Call911StartResponseOk | Call911StartResponseErr

export interface TwilioTokenResponseOk {
  ok: true
  token: string
}

export interface TwilioTokenResponseErr {
  ok: false
  error?: string
  message?: string
  missingEnv?: string[]
  hints?: string[]
}

export type TwilioTokenResponse = TwilioTokenResponseOk | TwilioTokenResponseErr

function joinUrl(base: string, path: string): string {
  const trimmed = base.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return trimmed ? `${trimmed}${p}` : p
}

/** Narrowed error payloads from /api/call-911/start or /api/twilio/token. */
export type VoiceApiErrorShape = {
  missingEnv?: string[]
  message?: string
  error?: string
  hints?: string[]
}

export function formatApiFailure(label: string, data: VoiceApiErrorShape): string {
  if (data.missingEnv?.length) {
    return `${label}: Missing: ${data.missingEnv.join(', ')}`
  }
  if (data.hints?.length) {
    return `${label}: ${data.hints.join(' ')}`
  }
  return `${label}: ${data.message || data.error || 'Request failed'}`
}

export async function postCall911Start(
  apiBaseUrl: string,
  theftContext?: string | null,
): Promise<Call911StartResponse> {
  const body =
    theftContext && theftContext.trim()
      ? JSON.stringify({ theftContext: theftContext.trim() })
      : '{}'
  const res = await fetch(joinUrl(apiBaseUrl, '/api/call-911/start'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body,
  })
  let data: Call911StartResponse
  try {
    data = (await res.json()) as Call911StartResponse
  } catch {
    return {
      ok: false,
      error: 'invalid_json',
      message: `HTTP ${res.status}: non-JSON response (is the API URL correct?)`,
    }
  }
  if (!res.ok && !(data as Call911StartResponseErr).error) {
    return {
      ok: false,
      error: 'http_error',
      message: `HTTP ${res.status}`,
    }
  }
  return data
}

export async function getTwilioVoiceToken(apiBaseUrl: string): Promise<TwilioTokenResponse> {
  const res = await fetch(joinUrl(apiBaseUrl, '/api/twilio/token'))
  let data: TwilioTokenResponse
  try {
    data = (await res.json()) as TwilioTokenResponse
  } catch {
    return {
      ok: false,
      error: 'invalid_json',
      message: `HTTP ${res.status}: non-JSON response (is the API URL correct?)`,
    }
  }
  if (!res.ok && !(data as TwilioTokenResponseErr).error) {
    return {
      ok: false,
      error: 'http_error',
      message: `HTTP ${res.status}`,
    }
  }
  return data
}
