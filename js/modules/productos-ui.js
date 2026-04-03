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

// Placeholder SVG en data URI (no necesita red)
const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f5f5f7'/%3E%3Ctext x='50%25' y='50%25' font-size='18' text-anchor='middle' dy='.3em' fill='%23999'%3ESin imagen%3C/text%3E%3C/svg%3E";

function renderCard(p) {
    const enCarrito = carrito.cantidadDe(p.id, null);
    const precioReal = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
    const agotado = p.stock <= 0 || enCarrito >= p.stock;
    const stockBajo = !agotado && p.stock <= 3;
    const descuento = (p.enoferta && p.preciooferta)
        ? Math.round((1 - p.preciooferta / p.precio) * 100)
        : null;
    const tieneVariantes = p.variantes && p.variantes.length > 0;

    let botonTexto = '';
    let botonIcono = '';
    let botonDisabled = false;

    if (tieneVariantes) {
        botonTexto = 'Ver opciones';
        botonIcono = '<i class="fas fa-eye"></i>';
        botonDisabled = false;
    } else if (agotado) {
        botonTexto = 'Agotado';
        botonIcono = '<i class="fas fa-times-circle"></i>';
        botonDisabled = true;
    } else {
        botonTexto = 'Añadir';
        botonIcono = '<i class="fas fa-cart-plus"></i>';
        botonDisabled = false;
    }

    return `
        <article class="product-card ${p.enoferta && p.preciooferta ? 'en-oferta' : ''}" data-id="${esc(p.id)}">
            ${descuento ? `<span class="card-badge-oferta">−${descuento}%</span>` : ''}
            ${stockBajo && !descuento && !tieneVariantes ? `<span class="card-stock-badge">¡Solo ${p.stock}!</span>` : ''}
            <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" decoding="async"
                 onerror="this.onerror=null; this.src='${PLACEHOLDER_SVG}'">
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
                <button class="card-btn-add" data-id="${esc(p.id)}" ${botonDisabled ? 'disabled' : ''} data-has-variants="${tieneVariantes}">
                    ${botonIcono} ${botonTexto}
                </button>
            </div>
        </article>`;
}

export function renderProductos(grid, productos) {
    if (!grid) return;
    if (productos.length === 0) {
        grid.innerHTML = `<div class="grid-empty"><i class="fas fa-box-open"></i><p>No hay productos disponibles aún.</p></div>`;
        return;
    }

    const ofertas = productos.filter(p => p.enoferta && p.preciooferta);
    const normales = productos.filter(p => !p.enoferta || !p.preciooferta);

    let html = '';
    if (ofertas.length > 0) {
        html += `<div class="seccion-header oferta-header"><i class="fas fa-fire"></i> Ofertas destacadas</div>${ofertas.map(renderCard).join('')}`;
        html += `<div class="seccion-header normal-header"><i class="fas fa-shopping-bag"></i> Todos los productos</div>`;
    }
    html += normales.map(renderCard).join('');
    grid.innerHTML = html;
}

export function mostrarError(grid) {
    if (!grid) return;
    grid.innerHTML = `<div class="grid-empty"><i class="fas fa-wifi" style="opacity:.4"></i><p>No se pudieron cargar los productos.</p><button onclick="location.reload()" style="margin-top:1rem;padding:8px 20px;border:1.5px solid currentColor;border-radius:8px;background:none;cursor:pointer;color:inherit">Reintentar</button></div>`;
}

export function bindGridEventos(grid, productos, onAgregar, onAbrirDetalle) {
    grid?.addEventListener('click', e => {
        const btn = e.target.closest('.card-btn-add');
        if (btn) {
            const tieneVariantes = btn.dataset.hasVariants === 'true';
            if (tieneVariantes) {
                const card = btn.closest('.product-card');
                if (card) onAbrirDetalle(card.dataset.id);
                return;
            }
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