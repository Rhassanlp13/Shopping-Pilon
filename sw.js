// Estrategia: HTML siempre desde red, estáticos desde caché
const CACHE_NAME = 'shopping-pilon-static-v1';
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

// Activación: limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim(); // Tomar control de las páginas abiertas
});

// Fetch: HTML siempre desde red, estáticos desde caché
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Si es HTML (página) -> ir a la red siempre
  if (event.request.mode === 'navigate' || 
      url.pathname === '/' || 
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } 
  // Para estáticos (CSS, JS, fuentes) -> caché primero
  else {
    event.respondWith(
      caches.match(event.request).then(response => 
        response || fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
      )
    );
  }
});
