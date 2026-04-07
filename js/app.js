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
});
