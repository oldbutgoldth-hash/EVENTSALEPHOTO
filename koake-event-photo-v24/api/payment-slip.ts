import uploadUrlHandler from '../server/paymentSlipUploadUrl.js'
import submitHandler from '../server/paymentSlipSubmit.js'
import reverifyHandler from '../server/paymentSlipReverify.js'
import { queryValue, type ApiRequest, type ApiResponse } from '../server/utils.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = queryValue(req.query?.action)
  if (action === 'upload-url') return uploadUrlHandler(req, res)
  if (action === 'submit') return submitHandler(req, res)
  if (action === 'reverify') return reverifyHandler(req, res)
  return res.status(404).json({ error: 'PAYMENT_SLIP_ACTION_NOT_FOUND' })
}
