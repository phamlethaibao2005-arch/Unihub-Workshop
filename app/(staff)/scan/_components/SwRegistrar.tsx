'use client'

import { useEffect } from 'react'

export default function SwRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(console.error)

    const handleOnline = () => {
      navigator.serviceWorker.controller?.postMessage({ type: 'ONLINE' })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
