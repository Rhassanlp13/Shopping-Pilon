// sw.js - Estrategia híbrida: admin.html siempre de red, el resto cache-first
const CACHE_NAME = 'pilon-v1.0.7';
const STATIC_ASSETS = [
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

// Instalación
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        }).catch(err => console.error('[SW] Error al cachear:', err))
    );
    self.skipWaiting();
});

// Activación
self.addEventListener('activate', event => {
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
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const request = event.request;

    // 🔹 admin.html NO se intercepta (siempre de la red)
    if (url.pathname === '/admin.html') {
        event.respondWith(fetch(request));
        return;
    }

    // 🔹 Otras páginas HTML (index.html, confirmar.html, etc.) - network-first
    if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match('/index.html');
            })
        );
        return;
    }

    // 🔹 Recursos estáticos (CSS, JS, iconos) - cache-first con actualización en segundo plano
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(request).then(response => {
                if (response) {
                    // Actualizar caché en segundo plano
                    fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, networkResponse.clone());
                            });
                        }
                    }).catch(console.warn);
                    return response;
                }
                return fetch(request);
            })
        );
        return;
    }

    // 🔹 Otros recursos (API, imágenes externas) - solo red
    event.respondWith(
        fetch(request).catch(() => {
            return new Response('Sin conexión. Revisa tu internet.', { status: 503 });
        })
    );
});