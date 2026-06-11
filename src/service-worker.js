/// <reference lib="webworker" />
// Minimal PWA service worker: precache the app shell so RAVEIRC is installable
// and loads offline. IRC traffic goes over a WebSocket (not fetch), so the SW
// never touches it.

import { build, files, version } from "$service-worker";

const CACHE = `raveirc-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener("install", (event) => {
  // Precache the new shell and take over right away so a redeploy is picked up
  // on the next load (the page reloads once via 'controllerchange').
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// (Kept for compatibility — the page can still request an immediate takeover.)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Cache-first for built assets; network-first (cache fallback) for the rest.
      if (ASSETS.includes(url.pathname)) {
        const hit = await cache.match(req);
        if (hit) return hit;
      }
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw new Error("offline and not cached");
      }
    })(),
  );
});
