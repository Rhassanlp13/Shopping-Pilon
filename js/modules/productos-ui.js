// productos-ui.js — Render del grid de productos
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

function renderCard(p) {
    const enCarrito = carrito.cantidadDe(p.id, null);
    const precioReal = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
    const agotado = p.stock <= 0 || enCarrito >= p.stock;
    const stockBajo = !agotado && p.stock <= 3;
    const descuento = (p.enoferta && p.preciooferta)
        ? Math.round((1 - p.preciooferta / p.precio) * 100)
        : null;

    return `
        <article class="product-card ${p.enoferta && p.preciooferta ? 'en-oferta' : ''}" data-id="${esc(p.id)}">
            ${descuento ? `<span class="card-badge-oferta">−${descuento}%</span>` : ''}
            ${stockBajo && !descuento ? `<span class="card-stock-badge">¡Solo ${p.stock}!</span>` : ''}
            <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy"
                 onerror="this.removeAttribute('onerror');this.src='https://placehold.co/400x400?text=Sin+imagen'">
            <div class="product-info">
                <span class="vendedor"><i class="fas fa-user-circle"></i> ${esc(p.vendedor)}</span>
                <h3>${esc(p.nombre)}</h3>
                <div class="price-wrap">
                    ${descuento ? `<span class="price-original">$${Number(p.precio).toLocaleString('es-CU')}</span>` : ''}
                    <span class="price ${descuento ? 'price-oferta' : ''}">
                        $${Number(precioReal).toLocaleString('es-CU')}
                    </span>
                    ${descuento ? `<span class="descuento-badge">−${descuento}%</span>` : ''}
                </div>
                <button class="card-btn-add" data-id="${esc(p.id)}" ${agotado ? 'disabled' : ''}>
                    ${agotado
                        ? '<i class="fas fa-times-circle"></i> Agotado'
                        : '<i class="fas fa-cart-plus"></i> Añadir'}
                </button>
            </div>
        </article>`;
}

export function renderProductos(grid, productos) {
    if (!grid) return;

    if (productos.length === 0) {
        grid.innerHTML = `
            <div class="grid-empty">
                <i class="fas fa-box-open"></i>
                <p>No hay productos disponibles aún.</p>
            </div>`;
        return;
    }

    const ofertas = productos.filter(p => p.enoferta && p.preciooferta);
    const normales = productos.filter(p => !p.enoferta || !p.preciooferta);

    let html = '';
    if (ofertas.length > 0) {
        html += `
            <div class="seccion-header oferta-header">
                <i class="fas fa-fire"></i> Ofertas destacadas
            </div>
            ${ofertas.map(renderCard).join('')}
            <div class="seccion-header normal-header">
                <i class="fas fa-shopping-bag"></i> Todos los productos
            </div>`;
    }
    html += normales.map(renderCard).join('');
    grid.innerHTML = html;
}

export function mostrarError(grid) {
    if (!grid) return;
    grid.innerHTML = `
        <div class="grid-empty">
            <i class="fas fa-wifi" style="opacity:.4"></i>
            <p>No se pudieron cargar los productos.</p>
            <button onclick="location.reload()"
                style="margin-top:1rem;padding:8px 20px;border:1.5px solid currentColor;
                       border-radius:8px;background:none;cursor:pointer;color:inherit">
                Reintentar
            </button>
        </div>`;
}

export function bindGridEventos(grid, productos, onAgregar, onAbrirDetalle) {
    grid?.addEventListener('click', e => {
        const btn = e.target.closest('.card-btn-add');
        if (btn) {
            if (btn.disabled) return;
            const res = carrito.agregar(btn.dataset.id, null, productos);
            if (res.ok) {
                onAgregar();
                mostrarToast(`🛒 ${res.msg}`, 'ok');
                const p = productos.find(p => p.id === btn.dataset.id);
                if (p && carrito.cantidadDe(p.id, null) >= p.stock) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-times-circle"></i> Agotado';
                }
            } else {
                mostrarToast(`❌ ${res.msg}`, 'error');
            }
            return;
        }
        const card = e.target.closest('.product-card');
        if (card) onAbrirDetalle(card.dataset.id);
    });
}
