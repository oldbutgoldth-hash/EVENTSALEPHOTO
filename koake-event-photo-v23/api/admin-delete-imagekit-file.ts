import ImageKit from '@imagekit/nodejs'
import { isAdminRequest, requiredEnv, type ApiRequest, type ApiResponse } from '../server/utils.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
  const body = (req.body || {}) as { fileId?: string }
  if (!body.fileId) return res.status(400).json({ error: 'FILE_ID_REQUIRED' })

  try {
    const client = new ImageKit({ privateKey: requiredEnv('IMAGEKIT_PRIVATE_KEY') })
    await client.files.delete(body.fileId)
    return res.status(200).json({ ok: true })
  } catch (error) {
    const candidate = error as { statusCode?: number; response?: { status?: number }; message?: string }
    const statusCode = candidate.statusCode || candidate.response?.status
    if (statusCode === 404 || /not found|404/i.test(candidate.message || '')) return res.status(200).json({ ok: true, alreadyDeleted: true })
    return res.status(500).json({ error: error instanceof Error ? error.message : 'IMAGEKIT_DELETE_FAILED' })
  }
}
