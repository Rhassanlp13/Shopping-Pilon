// cart-ui.js — Modal del carrito
import { carrito } from '../carrito.js';
import { mostrarToast } from './toast.js';

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const cartUI = {
    modal: null,
    itemsEl: null,
    totalEl: null,
    countEl: null,

    init() {
        this.modal   = document.getElementById('cart-modal');
        this.itemsEl = document.getElementById('cart-items');
        this.totalEl = document.getElementById('cart-total');
        this.countEl = document.getElementById('cart-count');
    },

    abrir(productos) {
        this.render(productos);
        this.modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    },

    cerrar() {
        this.modal.setAttribute('hidden', '');
        document.body.style.overflow = '';
    },

    actualizarContador() {
        if (!this.countEl) return;
        const n = carrito.cantidad;
        this.countEl.textContent = n;
        this.countEl.classList.remove('pop');
        void this.countEl.offsetWidth;
        if (n > 0) this.countEl.classList.add('pop');
        setTimeout(() => this.countEl.classList.remove('pop'), 300);
    },

    render(productos) {
        if (!this.itemsEl) return;
        const items = carrito.itemsConDatos(productos);

        if (items.length === 0) {
            this.itemsEl.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-bag"></i>
                    <p>Tu carrito está vacío</p>
                </div>`;
            this.totalEl.textContent = '0';
            return;
        }

        this.itemsEl.innerHTML = items.map(item => {
            const puedeAumentar = item.cantidad < item.stockDisponible;
            return `
                <div class="cart-item" data-id="${esc(item.id)}" data-variant="${esc(item.variantId ?? '')}">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${esc(item.nombre)}${esc(item.variantNombre)}</div>
                        <div class="cart-item-price">$${(item.precio * item.cantidad).toLocaleString('es-CU')} CUP</div>
                    </div>
                    <div class="qty-control">
                        <button class="qty-btn btn-disminuir" data-id="${esc(item.id)}" data-variant="${esc(item.variantId ?? '')}">−</button>
                        <span class="qty-num">${item.cantidad}</span>
                        <button class="qty-btn btn-aumentar" data-id="${esc(item.id)}" data-variant="${esc(item.variantId ?? '')}" ${!puedeAumentar ? 'disabled' : ''}>+</button>
                    </div>
                </div>`;
        }).join('');

        this.totalEl.textContent = carrito.total(productos).toLocaleString('es-CU');
    },

    bindEventos(productos, onCantidadCambiada) {
        document.getElementById('cart-btn')?.addEventListener('click', () => this.abrir(productos));
        document.getElementById('modal-close')?.addEventListener('click', () => this.cerrar());

        this.modal?.addEventListener('click', e => {
            if (e.target === this.modal) this.cerrar();
        });

        document.getElementById('btn-clear')?.addEventListener('click', () => {
            if (carrito.cantidad === 0) {
                mostrarToast('⚠️ El carrito ya está vacío', 'warning');
                return;
            }
            carrito.vaciar();
            this.actualizarContador();
            this.render(productos);
            onCantidadCambiada();
            mostrarToast('🗑️ Carrito vaciado', 'info');
        });

        this.itemsEl?.addEventListener('click', e => {
            const btnA = e.target.closest('.btn-aumentar');
            const btnD = e.target.closest('.btn-disminuir');

            if (btnA && !btnA.disabled) {
                const variantId = btnA.dataset.variant === '' ? null : btnA.dataset.variant;
                carrito.aumentar(btnA.dataset.id, variantId, productos);
                this.actualizarContador();
                this.render(productos);
                onCantidadCambiada();
            }
            if (btnD) {
                const variantId = btnD.dataset.variant === '' ? null : btnD.dataset.variant;
                carrito.disminuir(btnD.dataset.id, variantId);
                this.actualizarContador();
                this.render(productos);
                onCantidadCambiada();
                if (carrito.cantidad === 0) mostrarToast('🛒 Carrito vacío', 'info');
            }
        });
    },
};
