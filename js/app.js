import { cargarProductos, mostrarSkeleton } from './productos.js';
import { carrito } from './carrito.js';
import { UI } from './ui.js';
import { initAuth, bindAuthEvents } from './auth.js';
import { mostrarToast } from './modules/toast.js'; // ✅ Importar la función existente

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('grid');
    if (grid) mostrarSkeleton(grid);
    carrito.init();
    const { ok, data: productos } = await cargarProductos();
    UI.init(productos);
    if (!ok) UI.mostrarError();
    await initAuth();
    bindAuthEvents();

    // ========== DEEP LINKING: abrir producto desde URL ==========
    const urlParams = new URLSearchParams(window.location.search);
    const productoId = urlParams.get('producto');
    if (productoId && productos && productos.length) {
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
            setTimeout(() => UI.abrirDetalle(productoId), 500);
            // Limpiar URL sin recargar
            window.history.replaceState({}, '', window.location.pathname);
        }
    }
    // ============================================================

    // ========== REGISTRO DE SERVICE WORKER (PWA SIN CACHÉ AGRESIVA) ==========
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registrado correctamente');
            await registration.update();
            setInterval(() => {
                registration.update().catch(err => console.warn('Error al buscar actualización SW:', err));
            }, 60 * 60 * 1000);
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('Nueva versión del SW detectada. Recargando...');
                        mostrarToast('🔄 Actualizando tienda...', 'info');
                        setTimeout(() => window.location.reload(), 1500);
                    }
                });
            });
        } catch (err) {
            console.error('Error al registrar el Service Worker:', err);
        }
    }
    // =========================================================================
});
// Detectar cuando el service worker se actualiza
let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    mostrarToast('📢 Nueva versión disponible. Recargando...', 'info');
    window.location.reload();
});

// ========== INSTALACIÓN DE PWA ==========
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Previene que el navegador muestre el banner automáticamente
    e.preventDefault();
    // Guarda el evento para usarlo después
    deferredPrompt = e;
    // Muestra el botón de instalación
    const btnInstalar = document.getElementById('btn-instalar');
    if (btnInstalar) btnInstalar.style.display = 'inline-flex';
    console.log('✅ PWA instalable');
});

// Cuando el usuario hace clic en el botón de instalación
document.getElementById('btn-instalar')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Muestra el diálogo de instalación
    deferredPrompt.prompt();
    // Espera a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);
    // Limpia el evento y oculta el botón
    deferredPrompt = null;
    document.getElementById('btn-instalar').style.display = 'none';
});

// Si la app ya está instalada, oculta el botón (opcional)
window.addEventListener('appinstalled', () => {
    console.log('App instalada correctamente');
    const btnInstalar = document.getElementById('btn-instalar');
    if (btnInstalar) btnInstalar.style.display = 'none';
});