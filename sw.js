// sw.js - Estrategia híbrida: instalable y con actualizaciones controladas
const CACHE_NAME = 'pilon-v1.0.0'; // Cambia el número cuando actualices la app
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/style.css',
    '/manifest.json',
    '/js/app.js',
    '/js/ui.js',
    '/js/auth.js',
    '/js/admin.js',
    '/js/carrito.js',
    '/js/config.js',
    '/js/supabase.js',
    '/js/confirmar.js',
    '/js/productos.js',
    '/js/modules/toast.js',
    '/js/utils/escape.js',
    '/icon-192.png',
    '/icon-512.png'
];

// Instalación: descarga y cachea los recursos estáticos
self.addEventListener('install', event => {
    console.log('[SW] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        }).catch(err => console.error('[SW] Error al cachear:', err))
    );
    self.skipWaiting(); // Activa el nuevo SW inmediatamente
});

// Activación: elimina cachés antiguos
self.addEventListener('activate', event => {
    console.log('[SW] Activado y limpiando cachés antiguos');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Eliminando caché antigua:', key);
                    return caches.delete(key);
                }
            })
        ))
    );
    self.clients.claim(); // Toma control de las páginas abiertas
});

// Estrategia: cache-first para estáticos, network-first para el resto
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    // Si es un archivo estático (de la lista), usa cache-first
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) {
                    // Devuelve del caché y actualiza en segundo plano (stale-while-revalidate)
                    fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, networkResponse.clone());
                            });
                        }
                    }).catch(console.warn);
                    return response;
                }
                return fetch(event.request);
            })
        );
    } else {
        // Para otros recursos (API, imágenes externas), solo red
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response('Sin conexión. Revisa tu internet.', { status: 503 });
            })
        );
    }
});