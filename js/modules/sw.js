const CACHE_NAME = 'shopping-pilon-v9';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/js/app.js',
  '/js/ui.js',
  '/js/carrito.js',
  '/js/productos.js',
  '/js/supabase.js',
  '/js/config.js',
  '/js/modules/toast.js',
  '/js/modules/lightbox.js',
  '/js/modules/whatsapp.js',
  '/js/modules/productos-ui.js',
  '/js/modules/cart-ui.js',
  '/js/modules/detalle-ui.js',
  '/js/modules/resenas-ui.js',
  '/admin.html',
  '/js/admin.js',
  '/vender.html',
  '/confirmar.html',
  '/js/confirmar.js',
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
  // Admin y confirmar: siempre red primero
  const redPrimero = ['/admin.html', '/js/admin.js', '/confirmar.html', '/js/confirmar.js'];
  if (redPrimero.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
