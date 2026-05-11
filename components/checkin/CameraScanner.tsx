'use client'

import { useEffect, useRef } from 'react'

interface Props {
  onDecode: (raw: string) => void
  onClose: () => void
}

export default function CameraScanner({ onDecode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current) return
    const video = videoRef.current
    let controls: { stop(): void } | null = null
    let done = false

    // Dynamic import keeps @zxing/browser out of the server bundle
    import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      if (done) return
      const reader = new BrowserQRCodeReader()
      reader
        .decodeFromVideoDevice(undefined, video, (result, _err, ctrl) => {
          if (result && !done) {
            done = true
            ctrl.stop()
            onDecode(result.getText())
          }
        })
        .then((ctrl) => {
          controls = ctrl
        })
        .catch((err) => {
          if (!done) console.error('[CameraScanner]', err)
        })
    })

    return () => {
      done = true
      controls?.stop()
    }
  }, [onDecode])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl">
        <video ref={videoRef} className="w-full" autoPlay playsInline muted />
        {/* scan-frame overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-52 w-52 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
        </div>
      </div>
      <p className="mt-4 text-sm text-white/60">Point camera at QR code</p>
      <button
        onClick={onClose}
        className="mt-4 rounded-full border border-white/25 px-6 py-2 text-sm text-white/80 transition hover:bg-white/10"
      >
        Cancel
      </button>
    </div>
  )
}
