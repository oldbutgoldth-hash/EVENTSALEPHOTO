import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer>
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  send: (body: string | Buffer) => void
  setHeader: (name: string, value: string) => void
  redirect: (status: number, url: string) => void
}

export function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

export function siteUrl(req: ApiRequest): string {
  const configured = process.env.SITE_URL || process.env.VITE_SITE_URL
  if (configured) return configured.replace(/\/$/, '')
  const host = req.headers.host
  const hostname = Array.isArray(host) ? host[0] : host
  const protoHeader = req.headers['x-forwarded-proto']
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https'
  if (!hostname) throw new Error('SITE_URL_MISSING')
  return `${proto}://${hostname}`
}

export async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.details || `SUPABASE_${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export function supabaseAdmin() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function parseCookies(req: ApiRequest): Record<string, string> {
  const rawHeader = req.headers.cookie
  const raw = Array.isArray(rawHeader) ? rawHeader.join(';') : rawHeader || ''
  return Object.fromEntries(raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=')
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))]
  }))
}

function adminSignature(expiresAt: string): string {
  return crypto.createHmac('sha256', requiredEnv('ADMIN_SESSION_SECRET')).update(`koake-admin.${expiresAt}`).digest('hex')
}

export function createAdminCookie(): string {
  const expiresAt = String(Math.floor(Date.now() / 1000) + 8 * 60 * 60)
  const token = `${expiresAt}.${adminSignature(expiresAt)}`
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `koake_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 60 * 60}${secure}`
}

export function clearAdminCookie(): string {
  return 'koake_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
}

export function isAdminRequest(req: ApiRequest): boolean {
  const token = parseCookies(req).koake_admin
  if (!token) return false
  const [expiresAt, signature] = token.split('.')
  if (!expiresAt || !signature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false
  const expected = adminSignature(expiresAt)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function readRawBody(req: ApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req as AsyncIterable<Buffer>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}
