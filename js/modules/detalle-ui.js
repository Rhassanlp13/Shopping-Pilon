// detalle-ui.js — Modal de detalle de producto y selector de variantes
import { carrito } from '../carrito.js';
import { abrirLightbox, cerrarLightbox } from './lightbox.js';
import { mostrarToast } from './toast.js';
import { resenasUI } from './resenas-ui.js';

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const detalleUI = {
    productoActualId: null,
    varianteActual: null,

    async abrir(id, productos, onAgregar) {
        const p = productos.find(p => p.id === id);
        if (!p) return;

        this.productoActualId = id;
        this.varianteActual   = null;

        const modal       = document.getElementById('modal-detalle');
        const precioBase  = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
        const descuentoBase = (p.enoferta && p.preciooferta)
            ? Math.round((1 - p.preciooferta / p.precio) * 100)
            : null;

        const actualizarVista = (variante = null) => {
            cerrarLightbox();
            this.varianteActual = variante;

            const precio          = variante ? (variante.precio ?? p.precio) : precioBase;
            const stockVal        = variante ? (variante.stock ?? p.stock) : p.stock;
            const imagenUrl       = variante ? (variante.imagen ?? p.imagen) : p.imagen;
            const enC             = carrito.cantidadDe(id, variante ? p.variantes.indexOf(variante) : null);
            const agotado         = stockVal <= 0 || enC >= stockVal;

            const img = document.getElementById('detalle-img');
            img.style.opacity   = '0';
            img.style.transform = 'scale(0.97)';
            setTimeout(() => {
                img.src = esc(imagenUrl);
                img.style.transition = 'opacity .25s, transform .25s';
                img.style.opacity    = '1';
                img.style.transform  = 'scale(1)';
            }, 150);

            const precioEl = document.getElementById('detalle-precio');
            if (descuentoBase && !variante) {
                precioEl.innerHTML = `
                    <span style="text-decoration:line-through;color:#aaa;font-size:0.9em">$${Number(p.precio).toLocaleString('es-CU')}</span>
                    <span style="color:#e53935;font-weight:700"> $${Number(precio).toLocaleString('es-CU')}</span>
                    <span style="background:#ffebee;color:#c62828;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px">−${descuentoBase}%</span>`;
            } else {
                precioEl.textContent = Number(precio).toLocaleString('es-CU');
            }

            const stockEl = document.getElementById('detalle-stock');
            if (stockVal <= 0) {
                stockEl.textContent = 'Agotado';
                stockEl.className   = 'detalle-stock agotado';
            } else if (stockVal <= 3) {
                stockEl.textContent = `¡Solo quedan ${stockVal}!`;
                stockEl.className   = 'detalle-stock low';
            } else {
                stockEl.textContent = `${stockVal} disponibles`;
                stockEl.className   = 'detalle-stock ok';
            }

            const btnAdd = document.getElementById('detalle-btn-add');
            btnAdd.disabled  = agotado;
            btnAdd.innerHTML = agotado
                ? '<i class="fas fa-times-circle"></i> Sin stock'
                : '<i class="fas fa-cart-plus"></i> Añadir al carrito';
        };

        // Info base
        const detalleImg = document.getElementById('detalle-img');
        detalleImg.src        = esc(p.imagen);
        detalleImg.alt        = esc(p.nombre);
        detalleImg.style.cursor = 'pointer';
        // Limpiar listener previo clonando el nodo
        const newImg = detalleImg.cloneNode(true);
        detalleImg.parentNode.replaceChild(newImg, detalleImg);
        newImg.addEventListener('click', () => abrirLightbox(newImg.src));

        document.getElementById('detalle-vendedor').textContent = p.vendedor;
        document.getElementById('detalle-nombre').textContent   = p.nombre;

        // Variantes
        const contenedor = document.getElementById('detalle-variantes');
        contenedor.innerHTML = `
            <div class="variantes-titulo">
                <i class="fas fa-palette"></i> Opciones disponibles:
            </div>
            <div class="variantes-grid" id="variantes-grid"></div>
        `;
        const grid = contenedor.querySelector('#variantes-grid');

        const crearCard = (imagen, nombre, precio, stock, index, esBase) => {
            const card = document.createElement('div');
            card.className    = 'variante-card';
            card.dataset.index = index;
            if (esBase) card.classList.add('selected');
            card.innerHTML = `
                <div class="variante-imagen">
                    <img src="${esc(imagen)}" alt="${esc(nombre)}"
                         onerror="this.src='https://placehold.co/80x80?text=?'">
                </div>
                <div class="variante-info">
                    <div class="variante-nombre">${esc(nombre)}</div>
                    ${precio ? `<div class="variante-precio">$${Number(precio).toLocaleString('es-CU')}</div>` : ''}
                    <div class="variante-stock">${stock > 0 ? `${stock} disponibles` : 'Agotado'}</div>
                </div>
            `;
            return card;
        };

        // Opción base
        const baseCard = crearCard(p.imagen, p.nombre, p.precio, p.stock, -1, true);
        baseCard.addEventListener('click', () => {
            if (baseCard.classList.contains('selected')) return;
            document.querySelectorAll('.variante-card').forEach(c => c.classList.remove('selected'));
            baseCard.classList.add('selected');
            this.varianteActual = null;
            actualizarVista(null);
        });
        grid.appendChild(baseCard);

        // Variantes adicionales
        if (p.variantes?.length > 0) {
            p.variantes.forEach((v, i) => {
                const card = crearCard(v.imagen || p.imagen, v.nombre, v.precio, v.stock, i, false);
                card.addEventListener('click', () => {
                    if (card.classList.contains('selected')) return;
                    document.querySelectorAll('.variante-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.varianteActual = v;
                    actualizarVista(v);
                });
                grid.appendChild(card);
            });
        }
        contenedor.style.display = 'block';

        // Botón agregar — clonar para limpiar listeners previos
        const btnAdd = document.getElementById('detalle-btn-add');
        const newBtn = btnAdd.cloneNode(true);
        btnAdd.parentNode.replaceChild(newBtn, btnAdd);
        newBtn.onclick = () => {
            const variantId = this.varianteActual ? p.variantes.indexOf(this.varianteActual) : null;
            const res = carrito.agregar(id, variantId, productos);
            if (res.ok) {
                onAgregar();
                mostrarToast(`🛒 ${res.msg}`, 'ok');
                actualizarVista(this.varianteActual);
            } else {
                mostrarToast(`❌ ${res.msg}`, 'error');
            }
        };

        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';

        resenasUI.reset();
        await resenasUI.cargar(id);
        actualizarVista(null);
    },

    cerrar() {
        document.getElementById('modal-detalle').setAttribute('hidden', '');
        document.body.style.overflow = '';
        cerrarLightbox();
    },

    bindEventos() {
        document.getElementById('detalle-btn-cerrar')?.addEventListener('click', () => this.cerrar());
        document.getElementById('modal-detalle')?.addEventListener('click', e => {
            if (e.target === document.getElementById('modal-detalle')) this.cerrar();
        });
        resenasUI.bindEventos();
    },
};
