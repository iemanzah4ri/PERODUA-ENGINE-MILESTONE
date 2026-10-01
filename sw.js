const CACHE_PREFIX = 'perodua-milestones-';
const CONFIG_URL = new URL('./offline.json', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load offline asset list');

    const config = await response.json();
    const cache = await caches.open(config.version);
    await cache.addAll(config.assets);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX));
    const newestCache = await caches.open(cacheNames[cacheNames.length - 1]);
    const response = await newestCache.match(CONFIG_URL);
    if (!response) throw new Error('Offline asset list was not cached');

    const config = await response.json();
    const keep = config.version;

    await Promise.all(cacheNames
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== keep)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cacheNames = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX));
    const cacheName = cacheNames[cacheNames.length - 1];
    const cache = await caches.open(cacheName || `${CACHE_PREFIX}v1`);
    const cached = await cache.match(request, { ignoreSearch: true });

    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return cached || cache.match(new URL('./index.html', self.registration.scope).href);
      }
    }

    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
