function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function crc16(value: string): string {
  let crc = 0xffff
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function normalizePromptPayId(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) return `0066${digits.slice(1)}`
  if (digits.length === 13) return digits
  throw new Error('PROMPTPAY_ID_INVALID')
}

export function createPromptPayPayload(promptPayId: string, amountSatang: number, orderNumber: string): string {
  const merchantAccount = tlv('00', 'A000000677010111') + tlv('01', normalizePromptPayId(promptPayId))
  const additionalData = tlv('05', orderNumber.replace(/[^A-Z0-9-]/gi, '').slice(0, 25))
  const amount = (amountSatang / 100).toFixed(2)
  const payload = [
    tlv('00', '01'),
    tlv('01', '12'),
    tlv('29', merchantAccount),
    tlv('53', '764'),
    tlv('54', amount),
    tlv('58', 'TH'),
    tlv('62', additionalData),
    '6304',
  ].join('')
  return `${payload}${crc16(payload)}`
}
