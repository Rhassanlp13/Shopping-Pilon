// sw.js - Service Worker mínimo para PWA instalable SIN CACHÉ AGRESIVA
const CACHE_NAME = 'pilon-no-cache-v1';

// No cachear nada en la instalación
self.addEventListener('install', event => {
    console.log('SW instalado (sin cacheo previo)');
    self.skipWaiting(); // Activar inmediatamente
});

// Tomar control de las páginas abiertas
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    );
    self.clients.claim();
});

// Estrategia: SOLO RED, nada de caché (excepto si no hay red, entonces falla)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                // Opcional: devolver una página de error offline simple
                return new Response('Sin conexión. Revisa tu internet.', {
                    status: 503,
                    headers: new Headers({ 'Content-Type': 'text/plain' })
                });
            })
    );
});
