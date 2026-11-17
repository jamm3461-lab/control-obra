// Service worker: funcionamiento sin conexión + recibir archivos desde "Compartir" (WhatsApp).
importScripts('./db.js', './compromisos.js');

const VERSION = 'co-v7';
const SHELL = ['./', './index.html', './styles.css', './app.js', './db.js', './extract.js', './compromisos.js', './nube.js',
  './onedrive.js', './recibo.js', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

// Recordatorios de vencimientos en segundo plano (cuando Android/Chrome lo permite)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'vencimientos') e.waitUntil(revisarVencimientos(self.registration));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return clients.openWindow(url);
  }));
});
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'co-libs').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Archivos compartidos desde otra app (WhatsApp, Claude, galería…)
  if (e.request.method === 'POST' && url.pathname.endsWith('/compartir')) {
    e.respondWith(recibirCompartido(e.request));
    return;
  }
  if (e.request.method !== 'GET') return;

  // Librerías externas: primero caché
  if (CDN.includes(url.hostname)) {
    e.respondWith(caches.open('co-libs').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }

  // Archivos propios: primero red (para recibir actualizaciones), si no hay internet, caché
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  }
});

async function recibirCompartido(req) {
  try {
    const fd = await req.formData();
    const archivos = fd.getAll('archivos').filter(f => f && f.size);
    const texto = ['title', 'text', 'url'].map(k => fd.get(k)).filter(Boolean).join('\n');
    await DB.put('compartidos', {
      id: Date.now().toString(),
      archivos: archivos.map(f => ({ blob: f, nombre: f.name, tipo: f.type })),
      texto
    });
  } catch (err) {
    console.error('Error recibiendo archivo compartido', err);
  }
  return Response.redirect(new URL('./?compartido=1', self.registration.scope).href, 303);
}
