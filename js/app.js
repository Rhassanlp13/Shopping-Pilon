// app.js — Punto de entrada
import { cargarProductos, mostrarSkeleton } from './productos.js';
import { carrito } from './carrito.js';
import { UI } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('grid');

    if (grid) mostrarSkeleton(grid);

    carrito.init();

    const { ok, data: productos } = await cargarProductos();

    UI.init(productos);

    if (!ok) UI.mostrarError();

    // Gesto para login de admin
    const logo = document.querySelector('.logo');
    let pressTimer;

    logo.addEventListener('mousedown', () => {
        pressTimer = window.setTimeout(() => {
            window.location.href = '/admin.html';
        }, 3000); // 3 segundos
    });

    logo.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
    });

    // Para móvil (touchstart/touchend)
    logo.addEventListener('touchstart', () => {
        pressTimer = window.setTimeout(() => {
            window.location.href = '/admin.html';
        }, 3000);
    });

    logo.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
    });
});
