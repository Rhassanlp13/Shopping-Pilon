// ui.js — Fachada: orquesta todos los módulos de UI
import { carrito } from './carrito.js';
import { mostrarToast } from './modules/toast.js';
import { cartUI } from './modules/cart-ui.js';
import { detalleUI } from './modules/detalle-ui.js';
import { renderProductos, mostrarError, bindGridEventos } from './modules/productos-ui.js';
import { enviarWhatsApp } from './modules/whatsapp.js';

export const UI = {
    productos: [],
    grid: null,

    init(productos) {
        this.productos = productos;
        this.grid      = document.getElementById('grid');

        cartUI.init();
        detalleUI.bindEventos();

        renderProductos(this.grid, this.productos);
        cartUI.actualizarContador();
        this._bindEventos();
    },

    mostrarError() {
        mostrarError(this.grid);
    },

    _bindEventos() {
        // Grid de productos
        bindGridEventos(
            this.grid,
            this.productos,
            () => {
                cartUI.actualizarContador();
                renderProductos(this.grid, this.productos);
            },
            (id) => detalleUI.abrir(id, this.productos, () => {
                cartUI.actualizarContador();
                renderProductos(this.grid, this.productos);
            })
        );

        // WhatsApp
        document.getElementById('btn-whatsapp')?.addEventListener('click', () => {
            enviarWhatsApp(this.productos, (n) => {
                carrito.vaciar();
                cartUI.actualizarContador();
                renderProductos(this.grid, this.productos);
                cartUI.cerrar();
                mostrarToast(`✅ Pedido enviado a ${n} vendedor${n > 1 ? 'es' : ''}`, 'ok');
            });
        });

        // Carrito
        cartUI.bindEventos(this.productos, () => {
            renderProductos(this.grid, this.productos);
        });

        // Escape global
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (!cartUI.modal?.hasAttribute('hidden'))                                  cartUI.cerrar();
            if (!document.getElementById('modal-detalle')?.hasAttribute('hidden'))     detalleUI.cerrar();
        });
    },
};
