const CACHE_NAME = 'shopping-pilon-v15';

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
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Excluir imágenes de postimg.cc del caché (evita errores de conexión)
  if (url.hostname === 'i.postimg.cc') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Archivos críticos: network-first
  if (url.pathname === '/admin.html' ||
      url.pathname === '/js/admin.js' ||
      url.pathname === '/confirmar.html' ||
      url.pathname === '/js/confirmar.js') {
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
});
