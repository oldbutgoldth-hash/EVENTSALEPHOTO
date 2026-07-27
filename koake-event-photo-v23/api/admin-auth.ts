import crypto from 'node:crypto'
import ImageKit from '@imagekit/nodejs'
import {
  clearAdminCookie,
  createAdminCookie,
  isAdminRequest,
  queryValue,
  requiredEnv,
  type ApiRequest,
  type ApiResponse,
} from '../server/utils.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = queryValue(req.query?.action)

  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    const body = (req.body || {}) as { password?: string }
    const expected = process.env.ADMIN_PASSWORD || ''
    const received = body.password || ''
    const a = Buffer.from(received)
    const b = Buffer.from(expected)
    const matches = Boolean(expected) && a.length === b.length && crypto.timingSafeEqual(a, b)
    if (!matches) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' })
    res.setHeader('set-cookie', createAdminCookie())
    return res.status(200).json({ ok: true })
  }

  if (action === 'logout') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    res.setHeader('set-cookie', clearAdminCookie())
    return res.status(200).json({ ok: true })
  }

  if (action === 'session') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    res.setHeader('cache-control', 'no-store')
    return res.status(200).json({ authenticated: isAdminRequest(req) })
  }

  if (action === 'imagekit') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
    const imagekit = new ImageKit({ privateKey: requiredEnv('IMAGEKIT_PRIVATE_KEY').trim() })
    const { token, expire, signature } = imagekit.helper.getAuthenticationParameters()
    res.setHeader('cache-control', 'no-store')
    return res.status(200).json({ token, expire, signature, publicKey: requiredEnv('IMAGEKIT_PUBLIC_KEY').trim() })
  }

  return res.status(404).json({ error: 'ADMIN_AUTH_ACTION_NOT_FOUND' })
}
