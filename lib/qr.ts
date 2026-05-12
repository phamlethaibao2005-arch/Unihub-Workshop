'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function useQRDataUrl(payload: string | null | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!payload) {
        setDataUrl(null)
        return
      }
      QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        margin: 0,
        width: 320,
        color: { dark: '#111111', light: '#00000000' },
      })
        .then(setDataUrl)
        .catch(() => setDataUrl(null))
    }, 0)
    return () => window.clearTimeout(id)
  }, [payload])

  return dataUrl
}
