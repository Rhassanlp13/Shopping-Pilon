import { supabase } from './supabase.js';
import { carrito } from './carrito.js';
import { mostrarToast } from './modules/toast.js';
import { escapeHtml } from './utils/escape.js';
import { openAuthModal } from './auth.js';

let productoActual = null;
let varianteSeleccionada = null;
let TASA_USD_CUP = 250; // Valor por defecto

function optimizarImagen(url, ancho = 600, alto = 600) {
    if (!url) return '';
    if (url.includes('unsplash.com')) return `${url.split('?')[0]}?w=${ancho}&h=${alto}&fit=crop&auto=format&q=80`;
    return url;
}

// 1. Cargar datos del producto
async function cargarProducto() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const { data: p, error } = await supabase.from('productos').select('*').eq('id', id).single();
        if (error || !p) throw new Error('Producto no encontrado');

        productoActual = p;
        
        // Cargar tasa de cambio
        const { data: profileData } = await supabase.from('profiles').select('tasa_cambio').eq('id', p.seller_id).single();
        if (profileData?.tasa_cambio) TASA_USD_CUP = profileData.tasa_cambio;

        renderProducto(p);
        cargarResenas(id);
    } catch (err) {
        document.getElementById('producto-main').innerHTML = `
            <div style="text-align:center; width:100%; padding: 3rem;">
                <i class="fas fa-box-open" style="font-size: 3rem; color: var(--danger);"></i>
                <h2 style="margin-top: 1rem;">Producto no disponible</h2>
                <p>${err.message}</p>
                <a href="index.html" style="margin-top:1rem; display:inline-block; padding:10px 20px; background:var(--primary); color:white; border-radius:50px; text-decoration:none;">Volver al inicio</a>
            </div>`;
    }
}

// 2. Renderizar la página
function renderProducto(p) {
    document.title = `${p.nombre} | Granma Market`;
    
    const precioReal = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
    const moneda = p.moneda || 'CUP';
    const textoMoneda = moneda === 'USD' ? 'USD' : 'CUP';
    const precioCUP = moneda === 'USD' ? `<div style="font-size: 1rem; color: var(--text-muted); font-weight: 500;">≈ $${(precioReal * TASA_USD_CUP).toLocaleString('es')} CUP</div>` : '';
    const enCarrito = carrito.cantidadDe(p.id, null);
    const agotado = p.stock <= 0;

    const html = `
        <div class="prod-imagenes">
            <img src="${escapeHtml(optimizarImagen(p.imagen))}" alt="${escapeHtml(p.nombre)}" onerror="this.src='https://placehold.co/600x600?text=Sin+imagen'">
        </div>
        <div class="prod-detalles">
            <a href="tienda.html?vendedor=${p.seller_id}" class="prod-vendedor">
                <i class="fas fa-store" style="color: var(--primary);"></i> 
                <strong>${escapeHtml(p.vendedor)}</strong>
                <i class="fas fa-circle-check" style="color: #1d9bf0;"></i>
                ${p.municipio ? `· <i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.municipio)}` : ''}
            </a>
            
            <h1 class="prod-titulo">${escapeHtml(p.nombre)}</h1>
            
            <div class="prod-precio">
                $${Number(precioReal).toLocaleString('es')} ${textoMoneda}
                ${precioCUP}
            </div>

            <div style="font-size: 0.9rem; font-weight: 600; color: ${agotado ? 'var(--danger)' : 'var(--success)'};">
                ${agotado ? '<i class="fas fa-times-circle"></i> Agotado' : `<i class="fas fa-check-circle"></i> ${p.stock} disponibles`}
            </div>

            <!-- Variantes -->
            <div id="variantes-container" style="margin-top: 1rem; display: ${p.variantes?.length > 0 ? 'block' : 'none'};">
                <p style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">Opciones disponibles:</p>
                <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px;" id="variantes-list">
                    <div class="variante-card selected" data-index="-1">
                        <img src="${escapeHtml(optimizarImagen(p.imagen, 80, 80))}">
                        <span>Original</span>
                    </div>
                    ${(p.variantes || []).map((v, i) => `
                        <div class="variante-card" data-index="${i}">
                            <img src="${escapeHtml(optimizarImagen(v.imagen || p.imagen, 80, 80))}">
                            <span>${escapeHtml(v.nombre)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 1rem;">
                <button class="btn-accion btn-comprar" id="btn-add-cart" ${agotado ? 'disabled style="background:#ccc;cursor:not-allowed;"' : ''}>
                    <i class="fas fa-cart-plus"></i> ${agotado ? 'Sin stock' : 'Añadir al carrito'}
                </button>
                <button class="btn-accion btn-compartir" id="btn-share">
                    <i class="fab fa-whatsapp"></i> Compartir con un amigo
                </button>
            </div>
        </div>
    `;

    document.getElementById('producto-main').innerHTML = html;
    document.getElementById('producto-main').innerHTML += `<div class="resenas-box" style="width: 100%;" id="resenas-wrapper"><h3 class="resenas-titulo"><i class="fas fa-star"></i> Reseñas</h3><div id="resenas-lista">Cargando...</div></div>`;

    // Eventos
    document.getElementById('btn-add-cart')?.addEventListener('click', () => {
        const res = carrito.agregar(p.id, varianteSeleccionada, [p]);
        if (res.ok) {
            actualizarContador();
            mostrarToast('🛒 Añadido al carrito', 'ok');
            const btn = document.getElementById('btn-add-cart');
            btn.innerHTML = '<i class="fas fa-check"></i> ¡Añadido!';
            setTimeout(() => { btn.innerHTML = '<i class="fas fa-cart-plus"></i> Añadir al carrito'; }, 1500);
        } else {
            mostrarToast(`❌ ${res.msg}`, 'error');
        }
    });

    document.getElementById('btn-share')?.addEventListener('click', () => {
        const url = `${window.location.origin}/producto/${p.id}?v=${Date.now()}`;
        const texto = `🛍️ *${p.nombre}*\n💰 $${precioReal.toLocaleString('es')} ${textoMoneda}\n📍 ${p.municipio || 'Granma'}\n\nMira este producto en Granma Market:`;
        if (navigator.share) {
            navigator.share({ title: p.nombre, text: texto, url });
        } else {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto + '\n' + url)}`, '_blank');
        }
    });

    // Lógica de Variantes
    document.querySelectorAll('.variante-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.variante-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const idx = parseInt(card.dataset.index);
            varianteSeleccionada = idx === -1 ? null : idx;
            
            const btn = document.getElementById('btn-add-cart');
            if (btn) btn.disabled = false; // En una app real validaríamos el stock de la variante aquí
        });
    });
}

// 3. Reseñas
async function cargarResenas(productoId) {
    const lista = document.getElementById('resenas-lista');
    if (!lista) return;
    try {
        const { data } = await supabase.from('reseñas').select('*').eq('productoid', productoId).order('fecha', { ascending: false });
        if (!data || data.length === 0) {
            lista.innerHTML = '<p style="color:var(--text-muted);">Aún no hay reseñas para este producto.</p>';
            return;
        }
        lista.innerHTML = data.map(r => `
            <div style="border-bottom: 1px solid #eee; padding: 1rem 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>${escapeHtml(r.nombre)}</strong>
                    <span style="color:var(--accent);">${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}</span>
                </div>
                <p style="margin:0; font-size:0.9rem; color:var(--text);">${escapeHtml(r.texto)}</p>
            </div>
        `).join('');
    } catch (e) { lista.innerHTML = '<p>Error al cargar reseñas.</p>'; }
}

function actualizarContador() {
    const el = document.getElementById('cart-count');
    if (el) el.textContent = carrito.cantidad;
}

// Iniciar
document.addEventListener('DOMContentLoaded', () => {
    carrito.init();
    actualizarContador();
    cargarProducto();

    // Modal carrito (básico para esta página)
    document.getElementById('cart-btn')?.addEventListener('click', () => {
        document.getElementById('cart-modal').removeAttribute('hidden');
    });
    document.getElementById('modal-close')?.addEventListener('click', () => {
        document.getElementById('cart-modal').setAttribute('hidden', '');
    });
});