const CACHE_NAME = 'shopping-pilon-v4'; // ← Incrementa la versión para forzar actualización
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/confirmar.html',
  '/style.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/carrito.js',
  '/js/productos.js',
  '/js/supabase.js',
  '/js/config.js',
  '/js/admin.js',
  '/js/auth.js',
  '/js/modules/toast.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});
