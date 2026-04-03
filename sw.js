const CACHE_NAME = 'shopping-pilon-v18';

const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/vender.html',
  '/confirmar.html',
  '/style.css',
  '/manifest.json',
  '/robots.txt',
  '/CNAME',
  '/icon-192.png',
  '/icon-512.png',
  '/js/admin.js',
  '/js/app.js',
  '/js/auth.js',
  '/js/carrito.js',
  '/js/config.js',
  '/js/confirmar.js',
  '/js/productos.js',
  '/js/supabase.js',
  '/js/ui.js',
  '/js/modules/cart-ui.js',
  '/js/modules/detalle-ui.js',
  '/js/modules/lightbox.js',
  '/js/modules/productos-ui.js',
  '/js/modules/resenas-ui.js',
  '/js/modules/toast.js',
  '/js/modules/whatsapp.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Excluir imágenes de postimg.cc (si las usas)
  if (url.hostname === 'i.postimg.cc') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Excluir TODAS las peticiones a tu nuevo proyecto Supabase
  if (url.hostname === 'xistchuskgnmjrzlntve.supabase.co') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Archivos críticos del panel: network-first
  const critical = ['/admin.html', '/js/admin.js', '/confirmar.html', '/js/confirmar.js'];
  if (critical.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Resto: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});
