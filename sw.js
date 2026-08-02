/* The Forge service worker: cache-first for full offline use. */
const CACHE = 'forge-v17';
/* Voice clips live in their own cache that survives version bumps. They are
   content-addressed by hash, so a clip never changes under a given name and
   there is nothing to invalidate. Keeping them out of the versioned cache is
   what stops every app update from re-downloading 9 MB of audio. */
const AUDIO_CACHE = 'forge-audio';
try { importScripts('./audio/manifest.js'); } catch (err) {}
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-512.png'
];

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* cache: 'reload' skips the browser HTTP cache, otherwise a version bump can
       precache stale files (GitHub Pages serves everything with max-age=600) */
    await c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
    /* voice clips: precache what we can, tolerate individual failures. Any clip
       that misses the cache still plays online and falls back to speech offline. */
    if (self.AUDIO_MANIFEST && self.AUDIO_MANIFEST.files) {
      await c.add(new Request('./audio/manifest.js', { cache: 'reload' })).catch(() => {});
      const ac = await caches.open(AUDIO_CACHE);
      /* only fetch clips this device does not already hold */
      const have = new Set((await ac.keys()).map(r => r.url.split('/').pop()));
      const wanted = new Set(self.AUDIO_MANIFEST.files);
      const need = self.AUDIO_MANIFEST.files.filter(f => !have.has(f));
      await Promise.allSettled(need.map(f => ac.add('./audio/' + f)));
      /* and drop clips the manifest no longer references, so a voice change
         does not leave the old voice sitting in storage forever */
      for (const req of await ac.keys()) {
        const f = req.url.split('/').pop();
        if (/\.mp3$/.test(f) && !wanted.has(f)) await ac.delete(req);
      }
    }
    /* Fetch the font CSS and the woff2 files it names at install time, so the app
       is fully offline after the very first online visit. A synthesized Response is
       stored for the CSS because the page requests it no-cors, and a cached
       cors-type response would be rejected for that request. Failures here never
       block install; fonts then just arrive on a later online visit. */
    try {
      const res = await fetch(FONT_CSS);
      if (res.ok) {
        const css = await res.text();
        await c.put(FONT_CSS, new Response(css, { headers: { 'Content-Type': 'text/css' } }));
        const urls = [...new Set(Array.from(css.matchAll(/url\((https:[^)]+)\)/g), m => m[1]))];
        await Promise.all(urls.map(u =>
          fetch(u).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})
        ));
      }
    } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      /* drop old app-shell versions, never the audio cache */
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first: serve from cache, fall back to network and cache what comes back. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          const target = /\/audio\/[0-9a-f]{12}\.mp3$/.test(e.request.url) ? AUDIO_CACHE : CACHE;
          caches.open(target).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
