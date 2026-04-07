const CACHE_NAME = 'shopping-pilon-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/confirmar.html',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
];

// Instalación: solo guarda lo mínimo
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activación: limpia viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Fetch: CSS y JS siempre desde la red (nunca desde caché)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Los archivos CSS y JS nunca se cachean → siempre actuales
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Para el resto: intenta caché, si no, red
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
