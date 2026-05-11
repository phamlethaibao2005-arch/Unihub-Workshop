const CACHE = 'unihub-scan-v1'
const APP_SHELL = ['/scan']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Passthrough: all API calls go straight to the network
  if (url.pathname.startsWith('/api/')) return

  // Cache-first for Next.js static chunks (JS/CSS bundles)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((res) => {
            caches.open(CACHE).then((c) => c.put(event.request, res.clone()))
            return res
          }),
      ),
    )
    return
  }

  // Network-first for app shell pages; fall back to cache when offline
  event.respondWith(
    fetch(event.request).catch(
      () => caches.match(event.request).then((r) => r ?? Response.error()),
    ),
  )
})

// Clients post { type: 'ONLINE' } when the device regains connectivity.
// The SW broadcasts { type: 'SYNC_NOW' } so every open tab can flush its
// offline queue without coordinating through localStorage.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'ONLINE') return
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then((clients) => clients.forEach((c) => c.postMessage({ type: 'SYNC_NOW' })))
})
