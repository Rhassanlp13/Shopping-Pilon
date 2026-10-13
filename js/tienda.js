// tienda.js - Página de perfil del vendedor (con logo_tienda e icono verificado)
import { supabase } from './supabase.js';
import { carrito } from './carrito.js';
import { mostrarToast } from './modules/toast.js';
import { escapeHtml } from './utils/escape.js';

// ==================== AVATAR AUTOMÁTICO ====================
const AVATAR_COLORS = [
    '#064e3b', '#0891b2', '#7c3aed', '#db2777',
    '#ea580c', '#059669', '#4f46e5', '#b45309',
];

function generarIniciales(nombre) {
    if (!nombre) return '??';
    const palabras = nombre.trim().split(/\s+/).filter(p => p.length > 1);
    if (palabras.length === 0) return nombre.substring(0, 2).toUpperCase();
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

function generarColorAvatar(nombre) {
    if (!nombre) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ajustarBrillo(hex, porcentaje) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + porcentaje));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + porcentaje));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + porcentaje));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ==================== VALIDACIÓN UUID ====================
function esUUIDValido(str) {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ==================== OPTIMIZAR IMÁGENES ====================
function optimizarImagen(url, ancho = 400, alto = 400) {
    if (!url) return '';
    if (url.includes('unsplash.com')) {
        return `${url.split('?')[0]}?w=${ancho}&h=${alto}&fit=crop&auto=format&q=80`;
    }
    if (url.includes('?')) return `${url}&q=80`;
    return url;
}

// ==================== CARGA DE DATOS ====================
async function cargarTienda() {
    const params = new URLSearchParams(window.location.search);
    const sellerId = params.get('vendedor');
    const sellerNombre = params.get('nombre');

    if (!sellerId && !sellerNombre) {
        mostrarError('No se especificó un vendedor.');
        return;
    }

    let productos = [];
    let seller = null;

    // 1. Cargar productos por seller_id (UUID válido)
    if (sellerId && esUUIDValido(sellerId)) {
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) productos = data;
    }

    // 2. Fallback por nombre
    if (productos.length === 0 && sellerNombre) {
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('vendedor', sellerNombre)
            .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) productos = data;
    }

    // 3. Fallback por seller_id aunque no sea UUID
    if (productos.length === 0 && sellerId) {
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) productos = data;
    }

    // 4. Cargar perfil con logo_tienda
    if (sellerId && esUUIDValido(sellerId)) {
        const { data } = await supabase
            .from('profiles')
            .select('id, nombre_completo, nombre_tienda, logo_tienda, email, municipio, telefono, role')
            .eq('id', sellerId)
            .maybeSingle();
        if (data) seller = data;
    }

    // 5. Fallback: extraer info del producto
    if (!seller && productos.length > 0) {
        seller = {
            id: productos[0].seller_id,
            nombre_completo: productos[0].vendedor,
            nombre_tienda: productos[0].vendedor,
            logo_tienda: null,
            municipio: productos[0].municipio,
            email: null,
            telefono: productos[0].telefonovendedor,
        };
    }

    if (!seller && sellerNombre) {
        seller = {
            id: sellerId,
            nombre_completo: sellerNombre,
            nombre_tienda: sellerNombre,
            logo_tienda: null,
            municipio: null,
        };
    }

    if (!seller) {
        mostrarError('Esta tienda no existe o fue eliminada.');
        return;
    }

    const nombreVendedor = seller.nombre_tienda
        || seller.nombre_completo
        || seller.email?.split('@')[0]
        || sellerNombre
        || 'Vendedor';

    renderPerfil(nombreVendedor, seller.municipio, productos.length, seller.logo_tienda);
    renderProductos(productos);

    window._productosActuales = productos;
    document.title = `${nombreVendedor} | Granma Market`;
}

// ==================== RENDER PERFIL ====================
function renderPerfil(nombre, municipio, totalProductos, logoUrl = null) {
    const iniciales = generarIniciales(nombre);
    const color = generarColorAvatar(nombre);

    const avatarEl = document.getElementById('tienda-avatar');

    if (logoUrl) {
        avatarEl.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(nombre)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        avatarEl.style.background = 'transparent';
    } else {
        avatarEl.innerHTML = `<span id="tienda-iniciales">${iniciales}</span>`;
        avatarEl.style.background = `linear-gradient(135deg, ${color} 0%, ${ajustarBrillo(color, 20)} 100%)`;
    }

    // Nombre con icono de tienda + check de verificación
    document.getElementById('tienda-nombre').innerHTML = `
        <span class="tienda-icon-grande"><i class="fas fa-store"></i></span>
        ${escapeHtml(nombre)}
        <span class="tienda-nombre-verificado" title="Vendedor verificado">
            <i class="fas fa-circle-check"></i>
        </span>
    `;

    const municipioEl = document.getElementById('tienda-municipio');
    municipioEl.innerHTML = municipio
        ? `<i class="fas fa-map-marker-alt"></i> ${escapeHtml(municipio)}`
        : `<i class="fas fa-map-marker-alt"></i> Granma`;

    document.getElementById('tienda-productos-count').textContent =
        `${totalProductos} ${totalProductos === 1 ? 'producto' : 'productos'}`;

    document.getElementById('tienda-subtitle').textContent =
        totalProductos > 0 ? `Toca un producto para ver detalles` : '';

    document.title = `${nombre} | Granma Market`;
}

// ==================== RENDER PRODUCTOS ====================
function renderProductos(productos) {
    const grid = document.getElementById('grid');
    const estadoVacio = document.getElementById('estado-vacio');

    if (!productos || productos.length === 0) {
        grid.style.display = 'none';
        estadoVacio.style.display = 'block';
        estadoVacio.innerHTML = `
            <i class="fas fa-store-slash"></i>
            <p>Esta tienda aún no tiene productos disponibles.</p>
            <a href="index.html" style="margin-top: 1rem; display: inline-block; padding: 10px 22px; background: var(--primary); color: white; border-radius: 50px; text-decoration: none; font-weight: 600;">
                <i class="fas fa-arrow-left"></i> Volver al catálogo
            </a>
        `;
        return;
    }

    grid.style.display = 'grid';
    estadoVacio.style.display = 'none';

    grid.innerHTML = productos.map(p => {
        const precioReal = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
        const descuento = (p.enoferta && p.preciooferta) ? Math.round((1 - p.preciooferta / p.precio) * 100) : null;
        const agotado = p.stock <= 0;
        const stockBajo = !agotado && p.stock <= 3;
        const moneda = p.moneda || 'CUP';
        const textoMoneda = moneda === 'USD' ? ' USD' : ' CUP';

        return `
        <article class="product-card ${p.enoferta && p.preciooferta ? 'en-oferta' : ''}" data-id="${escapeHtml(p.id)}">
            ${descuento ? `<span class="card-badge-oferta">−${descuento}%</span>` : ''}
            ${stockBajo && !descuento ? `<span class="card-stock-badge">¡Solo ${p.stock}!</span>` : ''}
            <img src="${escapeHtml(optimizarImagen(p.imagen, 400, 400))}" alt="${escapeHtml(p.nombre)}" loading="lazy"
                 onerror="this.src='https://placehold.co/400x400?text=Sin+imagen'">
            <div class="product-info">
                <h3>${escapeHtml(p.nombre)}</h3>
                <div class="price-wrap">
                    ${descuento ? `<span class="price-original">$${Number(p.precio).toLocaleString('es')}${textoMoneda}</span>` : ''}
                    <span class="price ${descuento ? 'price-oferta' : ''}">$${Number(precioReal).toLocaleString('es')}${textoMoneda}</span>
                </div>
                <button class="card-btn-add" data-id="${escapeHtml(p.id)}" ${agotado ? 'disabled' : ''}>
                    ${agotado ? '<i class="fas fa-times-circle"></i> Agotado' : '<i class="fas fa-cart-plus"></i> Añadir'}
                </button>
            </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-btn-add')) return;
            abrirDetalleProducto(card.dataset.id, productos);
        });
    });

    grid.querySelectorAll('.card-btn-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.disabled) return;
            const id = btn.dataset.id;
            const res = carrito.agregar(id, null, productos);
            if (res.ok) {
                actualizarContadorCarrito();
                mostrarToast(`🛒 ${res.msg}`, 'ok');
                btn.innerHTML = '<i class="fas fa-check"></i> Añadido';
                setTimeout(() => {
                    const p = productos.find(p => p.id === id);
                    if (p && carrito.cantidadDe(p.id, null) >= p.stock) {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fas fa-times-circle"></i> Agotado';
                    } else {
                        btn.innerHTML = '<i class="fas fa-cart-plus"></i> Añadir';
                    }
                }, 1500);
            } else {
                mostrarToast(`❌ ${res.msg}`, 'error');
            }
        });
    });
}

// ==================== DETALLE ====================
function abrirDetalleProducto(id, productos) {
    const p = productos.find(x => x.id === id);
    if (!p) return;

    const modal = document.getElementById('modal-detalle');
    const moneda = p.moneda || 'CUP';
    const textoMoneda = moneda === 'USD' ? ' USD' : ' CUP';

    document.getElementById('detalle-img').src = optimizarImagen(p.imagen, 600, 600);
    document.getElementById('detalle-img').alt = p.nombre;

    document.getElementById('detalle-vendedor').innerHTML =
        `${escapeHtml(p.vendedor || 'Vendedor')}${p.municipio ? ` · <i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.municipio)}` : ''}`;

    document.getElementById('detalle-nombre').textContent = p.nombre;

    const precioReal = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
    document.getElementById('detalle-precio').innerHTML =
        `$${Number(precioReal).toLocaleString('es')}${textoMoneda}`;

    const stockEl = document.getElementById('detalle-stock');
    if (p.stock <= 0) {
        stockEl.textContent = 'Agotado';
        stockEl.className = 'detalle-stock agotado';
    } else if (p.stock <= 3) {
        stockEl.textContent = `¡Solo quedan ${p.stock}!`;
        stockEl.className = 'detalle-stock low';
    } else {
        stockEl.textContent = `${p.stock} disponibles`;
        stockEl.className = 'detalle-stock ok';
    }

    document.getElementById('detalle-variantes').innerHTML = '';

    const btnAdd = document.getElementById('detalle-btn-add');
    btnAdd.disabled = p.stock <= 0;
    btnAdd.innerHTML = p.stock <= 0
        ? '<i class="fas fa-times-circle"></i> Sin stock'
        : '<i class="fas fa-cart-plus"></i> Añadir al carrito';

    btnAdd.onclick = () => {
        const res = carrito.agregar(id, null, productos);
        if (res.ok) {
            actualizarContadorCarrito();
            mostrarToast(`🛒 ${res.msg}`, 'ok');
            btnAdd.innerHTML = '<i class="fas fa-check"></i> Añadido';
            setTimeout(() => {
                btnAdd.innerHTML = '<i class="fas fa-cart-plus"></i> Añadir al carrito';
            }, 1500);
        } else {
            mostrarToast(`❌ ${res.msg}`, 'error');
        }
    };

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
}

// ==================== CARRITO ====================
function actualizarContadorCarrito() {
    const el = document.getElementById('cart-count');
    if (el) el.textContent = carrito.cantidad;
}

function bindCarrito() {
    document.getElementById('cart-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('cart-modal');
        const items = carrito.itemsConDatos(window._productosActuales || []);
        const itemsEl = document.getElementById('cart-items');
        const totalEl = document.getElementById('cart-total');

        if (items.length === 0) {
            itemsEl.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-bag"></i><p>Tu carrito está vacío</p></div>`;
            totalEl.textContent = '0';
        } else {
            itemsEl.innerHTML = items.map(item => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${escapeHtml(item.nombre)}</div>
                        <div class="cart-item-price">$${(item.precio * item.cantidad).toLocaleString('es')}</div>
                    </div>
                    <span class="qty-num">x${item.cantidad}</span>
                </div>
            `).join('');
            totalEl.textContent = carrito.total(window._productosActuales || []).toLocaleString('es');
        }

        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    });

    document.getElementById('modal-close')?.addEventListener('click', () => {
        document.getElementById('cart-modal').setAttribute('hidden', '');
        document.body.style.overflow = '';
    });

    document.getElementById('detalle-btn-cerrar')?.addEventListener('click', () => {
        document.getElementById('modal-detalle').setAttribute('hidden', '');
        document.body.style.overflow = '';
    });

    document.getElementById('btn-whatsapp')?.addEventListener('click', () => {
        mostrarToast('Para completar el pedido, vuelve al catálogo principal', 'info');
    });

    document.getElementById('btn-clear')?.addEventListener('click', () => {
        carrito.vaciar();
        actualizarContadorCarrito();
        mostrarToast('🗑️ Carrito vaciado', 'info');
        document.getElementById('cart-modal').setAttribute('hidden', '');
        document.body.style.overflow = '';
    });
}

// ==================== ERROR ====================
function mostrarError(mensaje) {
    document.getElementById('grid').style.display = 'none';
    const estadoVacio = document.getElementById('estado-vacio');
    estadoVacio.style.display = 'block';
    estadoVacio.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i>
        <p>${escapeHtml(mensaje)}</p>
        <a href="index.html" style="margin-top: 1rem; display: inline-block; padding: 10px 22px; background: var(--primary); color: white; border-radius: 50px; text-decoration: none; font-weight: 600;">
            <i class="fas fa-arrow-left"></i> Ir al catálogo
        </a>
    `;
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    carrito.init();
    actualizarContadorCarrito();
    cargarTienda();
    bindCarrito();
});