// Estrategia: HTML siempre desde red, estáticos desde caché con actualización automática
const CACHE_NAME = 'shopping-pilon-v1';
const STATIC_ASSETS = [
  '/style.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/carrito.js',
  '/js/productos.js',
  '/js/supabase.js',
  '/js/config.js',
  '/js/admin.js',
  '/js/confirmar.js',
  '/js/modules/toast.js',
  '/js/utils/escape.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
];

// Instalación: guardar estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // Activar inmediatamente
});

// Activación: limpiar cachés antiguas y tomar control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Fetch: HTML siempre desde red, estáticos desde caché (con actualización en segundo plano)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isStatic = STATIC_ASSETS.some(asset => url.pathname === asset) || 
                   url.pathname.startsWith('/js/') || 
                   url.pathname === '/style.css';
  
  // Páginas HTML: siempre desde red
  if (event.request.mode === 'navigate' || 
      url.pathname === '/' || 
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } 
  // Recursos estáticos: caché primero, luego red, y actualizar caché en segundo plano
  else if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
  // El resto (imágenes, etc.) -> caché primero, red después
  else {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
  }
});
