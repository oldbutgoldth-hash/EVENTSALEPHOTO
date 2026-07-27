import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { LoaderCircle } from 'lucide-react'

export function QrCodeImage({ value, className = '' }: { value: string; className?: string }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#2d2d2d', light: '#ffffff' },
    }).then((dataUrl) => { if (!cancelled) setSrc(dataUrl) })
      .catch(() => { if (!cancelled) setSrc('') })
    return () => { cancelled = true }
  }, [value])

  if (!src) return <div className={`grid place-items-center bg-white ${className}`}><LoaderCircle className="animate-spin" size={34} /></div>
  return <img src={src} alt="QR ประจำงาน" className={className} />
}
