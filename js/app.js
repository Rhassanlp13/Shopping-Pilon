import { cargarProductos, mostrarSkeleton } from './productos.js';
import { carrito } from './carrito.js';
import { UI } from './ui.js';
import { initAuth, bindAuthEvents } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('grid');
    if (grid) mostrarSkeleton(grid);
    carrito.init();
    const { ok, data: productos } = await cargarProductos();
    UI.init(productos);
    if (!ok) UI.mostrarError();
    await initAuth();
    bindAuthEvents();

    // ========== REGISTRO DE SERVICE WORKER (PWA SIN CACHÉ AGRESIVA) ==========
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registrado correctamente');

            // Forzar búsqueda de actualización cada vez que se carga la página
            await registration.update();

            // Buscar actualización cada hora (por si la página queda abierta mucho tiempo)
            setInterval(() => {
                registration.update().catch(err => console.warn('Error al buscar actualización SW:', err));
            }, 60 * 60 * 1000);

            // Detectar cuando hay una nueva versión esperando
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Nueva versión disponible → recargar automáticamente
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

// Función auxiliar para mostrar toasts (si no existe globalmente, la definimos)
function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}