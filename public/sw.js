const IMAGE_CACHE_NAME = 'lct-coin-images-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function isCoinImageRequest(request, url) {
  if (request.method !== 'GET') return false;
  const isCoinGeckoHost =
    url.hostname === 'coin-images.coingecko.com' ||
    url.hostname === 'assets.coingecko.com' ||
    url.hostname.endsWith('.coingecko.com');
  const isCoinCapHost = url.hostname === 'assets.coincap.io';
  if (!isCoinGeckoHost && !isCoinCapHost) return false;
  return (
    request.destination === 'image' ||
    url.pathname.includes('/coins/images/') ||
    url.pathname.includes('/assets/icons/')
  );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!isCoinImageRequest(event.request, url)) return;

  event.respondWith(
    caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreVary: true });
      if (cached) {
        return cached;
      }

      const response = await fetch(event.request);
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    })
  );
});
