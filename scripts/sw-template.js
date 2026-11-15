const CACHE = __CACHE__;
const FILES = __FILES__;
const URLS = new Set(FILES);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await Promise.all(FILES.map(async url => {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (!response.ok) throw new Error('Precache failed: ' + url);
        await cache.put(url, new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers }));
      }));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('noupload-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(Promise.resolve(Response.error()));
    return;
  }
  if (event.request.method !== 'GET') {
    event.respondWith(Promise.resolve(Response.error()));
    return;
  }
  let path = url.pathname;
  if (event.request.mode === 'navigate') {
    if (path.endsWith('/')) path += 'index.html';
    else if (URLS.has(path + '/index.html')) path += '/index.html';
    else if (URLS.has(path + '.html')) path += '.html';
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(path);
    if (cached) return cached;
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        if (response.ok) return response;
      } catch {}
      const fallbackPath = url.pathname.startsWith('/hi/') ? '/hi/404.html' : '/404.html';
      const fallback = await cache.match(fallbackPath);
      if (fallback) {
        const html = (await fallback.text()).replace(/\b(href|src)="([^"]+)"/g, (tag, key, value) => value.startsWith('.') ? key + '="' + new URL(value, self.location.origin + fallbackPath).pathname + '"' : tag);
        return new Response(html, { status: 404, headers: fallback.headers });
      }
    }
    return new Response('Not available offline', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  })());
});
