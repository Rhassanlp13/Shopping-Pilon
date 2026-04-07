import { supabase } from './supabase.js';
import { carrito } from './carrito.js';
import { CONFIG } from './config.js';
import { mostrarToast } from './modules/toast.js';
import { escapeHtml } from './utils/escape.js';

export const UI = {
    grid: null,
    cartCount: null,
    cartModal: null,
    cartItems: null,
    cartTotal: null,
    productos: [],
    productoActualId: null,
    estrellaSeleccionada: 0,
    varianteActual: null,

    init(productos) {
        this.productos = productos;
        this.grid = document.getElementById('grid');
        this.cartCount = document.getElementById('cart-count');
        this.cartModal = document.getElementById('cart-modal');
        this.cartItems = document.getElementById('cart-items');
        this.cartTotal = document.getElementById('cart-total');
        this.renderProductos();
        this.actualizarContador();
        this.bindEventos();
    },

    renderProductos() {
        if (!this.grid) return;
        if (this.productos.length === 0) {
            this.grid.innerHTML = `<div class="grid-empty"><i class="fas fa-box-open"></i><p>No hay productos disponibles aún.</p></div>`;
            return;
        }
        const ofertas = this.productos.filter(p => p.enoferta && p.preciooferta);
        const normales = this.productos.filter(p => !p.enoferta || !p.preciooferta);
        const renderCard = (p) => {
            const enCarrito = carrito.cantidadDe(p.id, null);
            const precioReal = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
            const agotado = p.stock <= 0 || enCarrito >= p.stock;
            const stockBajo = !agotado && p.stock <= 3;
            const descuento = (p.enoferta && p.preciooferta) ? Math.round((1 - p.preciooferta / p.precio) * 100) : null;
            return `
                <article class="product-card ${p.enoferta && p.preciooferta ? 'en-oferta' : ''}" data-id="${escapeHtml(p.id)}">
                    ${descuento ? `<span class="card-badge-oferta">−${descuento}%</span>` : ''}
                    ${stockBajo && !descuento ? `<span class="card-stock-badge">¡Solo ${p.stock}!</span>` : ''}
                    <img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}" loading="lazy" onerror="this.src='https://placehold.co/400x400?text=Sin+imagen'">
                    <div class="product-info">
                        <span class="vendedor"><i class="fas fa-user-circle"></i> ${escapeHtml(p.vendedor)}</span>
                        <h3>${escapeHtml(p.nombre)}</h3>
                        <div class="price-wrap">
                            ${descuento ? `<span class="price-original">$${Number(p.precio).toLocaleString('es-CU')}</span>` : ''}
                            <span class="price ${descuento ? 'price-oferta' : ''}">$${Number(precioReal).toLocaleString('es-CU')}</span>
                            ${descuento ? `<span class="descuento-badge">−${descuento}%</span>` : ''}
                        </div>
                        <button class="card-btn-add" data-id="${escapeHtml(p.id)}" ${agotado ? 'disabled' : ''}>
                            ${agotado ? '<i class="fas fa-times-circle"></i> Agotado' : '<i class="fas fa-cart-plus"></i> Añadir'}
                        </button>
                    </div>
                </article>`;
        };
        let html = '';
        if (ofertas.length > 0) {
            html += `<div class="seccion-header oferta-header"><i class="fas fa-fire"></i> Ofertas destacadas</div>${ofertas.map(renderCard).join('')}<div class="seccion-header normal-header"><i class="fas fa-shopping-bag"></i> Todos los productos</div>`;
        }
        html += normales.map(renderCard).join('');
        this.grid.innerHTML = html;
    },

    mostrarError() {
        if (!this.grid) return;
        this.grid.innerHTML = `<div class="grid-empty"><i class="fas fa-wifi" style="opacity:.4"></i><p>No se pudieron cargar los productos.</p><button onclick="location.reload()" style="margin-top:1rem;padding:8px 20px;border:1.5px solid currentColor;border-radius:8px;background:none;cursor:pointer;color:inherit">Reintentar</button></div>`;
    },

    actualizarContador() {
        if (!this.cartCount) return;
        const n = carrito.cantidad;
        this.cartCount.textContent = n;
        this.cartCount.classList.remove('pop');
        void this.cartCount.offsetWidth;
        if (n > 0) this.cartCount.classList.add('pop');
        setTimeout(() => this.cartCount.classList.remove('pop'), 300);
    },

    abrirModal() {
        this.renderCarrito();
        this.cartModal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    },

    cerrarModal() {
        this.cartModal.setAttribute('hidden', '');
        document.body.style.overflow = '';
    },

    renderCarrito() {
        if (!this.cartItems) return;
        const items = carrito.itemsConDatos(this.productos);
        if (items.length === 0) {
            this.cartItems.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-bag"></i><p>Tu carrito está vacío</p></div>`;
            this.cartTotal.textContent = '0';
            return;
        }
        this.cartItems.innerHTML = items.map(item => {
            const puedeAumentar = item.cantidad < item.stockDisponible;
            return `<div class="cart-item" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}"><div class="cart-item-info"><div class="cart-item-name">${escapeHtml(item.nombre)}${escapeHtml(item.variantNombre)}</div><div class="cart-item-price">$${(item.precio * item.cantidad).toLocaleString('es-CU')} CUP</div></div><div class="qty-control"><button class="qty-btn btn-disminuir" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}">−</button><span class="qty-num">${item.cantidad}</span><button class="qty-btn btn-aumentar" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}" ${!puedeAumentar ? 'disabled' : ''}>+</button></div></div>`;
        }).join('');
        this.cartTotal.textContent = carrito.total(this.productos).toLocaleString('es-CU');
    },

    abrirLightbox() {
        const imgSrc = document.getElementById('detalle-img').src;
        if (!imgSrc) return;
        let overlay = document.getElementById('lightbox-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'lightbox-overlay';
            overlay.className = 'lightbox-overlay';
            overlay.innerHTML = `<span class="lightbox-close">&times;</span><img class="lightbox-img" src="">`;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.classList.contains('lightbox-close')) overlay.classList.remove('active'); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('active')) overlay.classList.remove('active'); });
        }
        const lightboxImg = overlay.querySelector('.lightbox-img');
        lightboxImg.src = imgSrc;
        overlay.classList.add('active');
    },

    cerrarLightbox() {
        const overlay = document.getElementById('lightbox-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    async abrirDetalle(id) {
        const p = this.productos.find(p => p.id === id);
        if (!p) return;
        this.productoActualId = id;
        this.varianteActual = null;
        const modal = document.getElementById('modal-detalle');
        const precioBase = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
        const descuentoBase = (p.enoferta && p.preciooferta) ? Math.round((1 - p.preciooferta / p.precio) * 100) : null;
        const actualizarVista = (variante = null) => {
            this.cerrarLightbox();
            this.varianteActual = variante;
            const precio = variante ? (variante.precio ?? p.precio) : precioBase;
            const stockVal = variante ? (variante.stock ?? p.stock) : p.stock;
            const imagenUrl = variante ? (variante.imagen ?? p.imagen) : p.imagen;
            const enC = carrito.cantidadDe(id, variante ? p.variantes.indexOf(variante) : null);
            const agotado = stockVal <= 0 || enC >= stockVal;
            const img = document.getElementById('detalle-img');
            img.style.opacity = '0';
            img.style.transform = 'scale(0.97)';
            setTimeout(() => {
                img.src = escapeHtml(imagenUrl);
                img.style.transition = 'opacity .25s, transform .25s';
                img.style.opacity = '1';
                img.style.transform = 'scale(1)';
            }, 150);
            const precioEl = document.getElementById('detalle-precio');
            if (descuentoBase && !variante) {
                precioEl.innerHTML = `<span style="text-decoration:line-through;color:#aaa;font-size:0.9em">$${Number(p.precio).toLocaleString('es-CU')}</span> <span style="color:#e53935;font-weight:700"> $${Number(precio).toLocaleString('es-CU')}</span> <span style="background:#ffebee;color:#c62828;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px">−${descuentoBase}%</span>`;
            } else {
                precioEl.textContent = Number(precio).toLocaleString('es-CU');
            }
            const stockEl = document.getElementById('detalle-stock');
            if (stockVal <= 0) { stockEl.textContent = 'Agotado'; stockEl.className = 'detalle-stock agotado'; }
            else if (stockVal <= 3) { stockEl.textContent = `¡Solo quedan ${stockVal}!`; stockEl.className = 'detalle-stock low'; }
            else { stockEl.textContent = `${stockVal} disponibles`; stockEl.className = 'detalle-stock ok'; }
            const btnAdd = document.getElementById('detalle-btn-add');
            btnAdd.disabled = agotado;
            btnAdd.innerHTML = agotado ? '<i class="fas fa-times-circle"></i> Sin stock' : '<i class="fas fa-cart-plus"></i> Añadir al carrito';
        };
        document.getElementById('detalle-img').src = escapeHtml(p.imagen);
        document.getElementById('detalle-img').alt = escapeHtml(p.nombre);
        document.getElementById('detalle-vendedor').textContent = p.vendedor;
        document.getElementById('detalle-nombre').textContent = p.nombre;
        const detalleImg = document.getElementById('detalle-img');
        detalleImg.style.cursor = 'pointer';
        detalleImg.addEventListener('click', () => this.abrirLightbox());
        const contenedor = document.getElementById('detalle-variantes');
        contenedor.innerHTML = `<div class="variantes-titulo"><i class="fas fa-palette"></i> Opciones disponibles:</div><div class="variantes-grid" id="variantes-grid"></div>`;
        const grid = contenedor.querySelector('#variantes-grid');
        const baseCard = document.createElement('div');
        baseCard.className = 'variante-card';
        if (!this.varianteActual) baseCard.classList.add('selected');
        baseCard.dataset.index = -1;
        baseCard.innerHTML = `<div class="variante-imagen"><img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}" onerror="this.src='https://placehold.co/80x80?text=?'"></div><div class="variante-info"><div class="variante-nombre">${escapeHtml(p.nombre)}</div><div class="variante-precio">$${Number(p.precio).toLocaleString('es-CU')}</div><div class="variante-stock">${p.stock > 0 ? `${p.stock} disponibles` : 'Agotado'}</div></div>`;
        baseCard.addEventListener('click', () => {
            if (baseCard.classList.contains('selected')) return;
            document.querySelectorAll('.variante-card').forEach(c => c.classList.remove('selected'));
            baseCard.classList.add('selected');
            this.varianteActual = null;
            actualizarVista(null);
        });
        grid.appendChild(baseCard);
        if (p.variantes && p.variantes.length > 0) {
            p.variantes.forEach((v, i) => {
                const imagenVar = v.imagen || p.imagen;
                const card = document.createElement('div');
                card.className = 'variante-card';
                card.dataset.index = i;
                card.innerHTML = `<div class="variante-imagen"><img src="${escapeHtml(imagenVar)}" alt="${escapeHtml(v.nombre)}" onerror="this.src='https://placehold.co/80x80?text=?'"></div><div class="variante-info"><div class="variante-nombre">${escapeHtml(v.nombre)}</div>${v.precio ? `<div class="variante-precio">$${v.precio.toLocaleString('es-CU')}</div>` : ''}<div class="variante-stock">${v.stock > 0 ? `${v.stock} disponibles` : 'Agotado'}</div></div>`;
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
        const btnAdd = document.getElementById('detalle-btn-add');
        btnAdd.onclick = () => {
            const variantId = this.varianteActual ? p.variantes.indexOf(this.varianteActual) : null;
            const res = carrito.agregar(id, variantId, this.productos);
            if (res.ok) {
                this.actualizarContador();
                mostrarToast(`🛒 ${res.msg}`, 'ok');
                actualizarVista(this.varianteActual);
            } else {
                mostrarToast(`❌ ${res.msg}`, 'error');
            }
        };
        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
        document.getElementById('resena-nombre').value = '';
        document.getElementById('resena-texto').value = '';
        this.estrellaSeleccionada = 0;
        this.actualizarEstrellas(0);
        await this.cargarResenas(id);
    },

    cerrarDetalle() {
        document.getElementById('modal-detalle').setAttribute('hidden', '');
        document.body.style.overflow = '';
        this.cerrarLightbox();
    },

    async cargarResenas(productoId) {
        const lista = document.getElementById('resenas-lista');
        const count = document.getElementById('resenas-count');
        if (!lista) return;
        lista.innerHTML = '<div class="resenas-empty"><i class="fas fa-spinner fa-spin"></i></div>';
        try {
            const { data, error } = await supabase.from('reseñas').select('*').eq('productoid', productoId).order('fecha', { ascending: false });
            if (error) throw error;
            count.textContent = data.length > 0 ? `(${data.length})` : '';
            if (data.length === 0) { lista.innerHTML = '<div class="resenas-empty"><i class="fas fa-comment-slash"></i><br>Sin reseñas aún. ¡Sé el primero!</div>'; return; }
            lista.innerHTML = data.map(r => `<div class="resena-item"><div class="resena-header"><span class="resena-autor">${escapeHtml(r.nombre)}</span><span class="resena-estrellas">${'★'.repeat(Number(r.estrellas))}${'☆'.repeat(5 - Number(r.estrellas))}</span></div><div class="resena-texto">${escapeHtml(r.texto)}</div><div class="resena-fecha">${new Date(r.fecha).toLocaleDateString('es-CU', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>`).join('');
        } catch (err) { lista.innerHTML = '<div class="resenas-empty">No se pudieron cargar las reseñas.</div>'; }
    },

    async enviarResena() {
        const nombre = document.getElementById('resena-nombre').value.trim();
        const texto = document.getElementById('resena-texto').value.trim();
        const estrellas = this.estrellaSeleccionada;
        if (!nombre || !texto || estrellas === 0) { mostrarToast('⚠️ Completa nombre, estrellas y opinión', 'warning'); return; }
        const btn = document.getElementById('btn-enviar-resena');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
        try {
            const { error } = await supabase.from('reseñas').insert([{ productoid: this.productoActualId, nombre: nombre.slice(0, 30), texto: texto.slice(0, 200), estrellas: Math.min(5, Math.max(1, estrellas)), fecha: new Date().toISOString() }]);
            if (error) throw error;
            mostrarToast('✅ Reseña publicada', 'ok');
            document.getElementById('resena-nombre').value = '';
            document.getElementById('resena-texto').value = '';
            this.estrellaSeleccionada = 0;
            this.actualizarEstrellas(0);
            await this.cargarResenas(this.productoActualId);
        } catch (err) { mostrarToast('❌ Error al publicar reseña', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar reseña'; }
    },

    actualizarEstrellas(valor) {
        document.querySelectorAll('#estrellas-input i').forEach((star, i) => star.classList.toggle('activa', i < valor));
    },

    async guardarPedido(nombreCliente, telefonoCliente, items) {
        const total = items.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
        const seller_id = items[0]?.seller_id;
        if (!seller_id) return null;
        const productosData = items.map(it => ({ id: it.id, variantId: it.variantId, nombre: it.nombre, cantidad: it.cantidad, precio: it.precio, vendedor_id: seller_id }));
        const { data, error } = await supabase.from('pedidos').insert([{ cliente_nombre: nombreCliente, cliente_telefono: telefonoCliente, total, productos: productosData, vendedor_id: seller_id, status: 'pendiente' }]).select().single();
        if (error) { console.error('Error guardando pedido:', error); return null; }
        return data.id;
    },

    async enviarWhatsApp() {
        const nombre = document.getElementById('cliente-nombre')?.value.trim();
        const telefono = document.getElementById('cliente-telefono')?.value.trim();
        let valido = true;
        if (!nombre) { document.getElementById('g-cliente-nombre')?.classList.add('error'); valido = false; }
        else { document.getElementById('g-cliente-nombre')?.classList.remove('error'); }
        if (!telefono) { document.getElementById('g-cliente-tel')?.classList.add('error'); valido = false; }
        else { document.getElementById('g-cliente-tel')?.classList.remove('error'); }
        if (!valido) return;
        const items = carrito.itemsConDatos(this.productos);
        if (items.length === 0) { mostrarToast('⚠️ Tu carrito está vacío', 'warning'); return; }
        const porVendedor = {};
        items.forEach(item => { const tel = item.telefonovendedor || CONFIG.whatsapp; if (!porVendedor[tel]) porVendedor[tel] = { telefono: tel, vendedor: item.vendedor, items: [] }; porVendedor[tel].items.push(item); });
        const vendedores = Object.values(porVendedor);
        const pedidosIds = [];
        for (const grupo of vendedores) { const id = await this.guardarPedido(nombre, telefono, grupo.items); if (id) pedidosIds.push(id); }
        vendedores.forEach((grupo, i) => {
            const totalGrupo = grupo.items.reduce((s, it) => s + it.precio * it.cantidad, 0);
            let texto = `🛍️ *Pedido — Shopping Pilón*\n\n👤 *Cliente:* ${nombre}\n📞 *Teléfono:* ${telefono}\n\n📦 *Productos:*\n`;
            grupo.items.forEach(item => { texto += `• ${item.nombre}${item.variantNombre} x${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString('es-CU')} CUP\n`; });
            texto += `\n💰 *Total: $${totalGrupo.toLocaleString('es-CU')} CUP*\n`;
            if (vendedores.length > 1) texto += `\n_Pedido dividido entre ${vendedores.length} vendedores._`;
            if (pedidosIds[i]) texto += `\n🔗 *Confirmar pedido:* ${window.location.origin}/confirmar.html?pedido=${pedidosIds[i]}`;
            texto += `\n\nHola, me gustaría confirmar este pedido. 😊`;
            setTimeout(() => window.open(`https://wa.me/${grupo.telefono}?text=${encodeURIComponent(texto)}`, '_blank'), i * 800);
        });
        setTimeout(() => { carrito.vaciar(); this.actualizarContador(); this.renderProductos(); this.cerrarModal(); mostrarToast(`✅ Pedido enviado a ${vendedores.length} vendedor${vendedores.length > 1 ? 'es' : ''}`, 'ok'); document.getElementById('cliente-nombre').value = ''; document.getElementById('cliente-telefono').value = ''; }, vendedores.length * 800);
    },

    bindEventos() {
        document.getElementById('cart-btn')?.addEventListener('click', () => this.abrirModal());
        document.getElementById('modal-close')?.addEventListener('click', () => this.cerrarModal());
        this.cartModal?.addEventListener('click', e => { if (e.target === this.cartModal) this.cerrarModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!this.cartModal?.hasAttribute('hidden')) this.cerrarModal(); if (!document.getElementById('modal-detalle')?.hasAttribute('hidden')) this.cerrarDetalle(); } });
        document.getElementById('btn-whatsapp')?.addEventListener('click', () => this.enviarWhatsApp());
        document.getElementById('btn-clear')?.addEventListener('click', () => { if (carrito.cantidad === 0) { mostrarToast('⚠️ El carrito ya está vacío', 'warning'); return; } carrito.vaciar(); this.actualizarContador(); this.renderCarrito(); this.renderProductos(); mostrarToast('🗑️ Carrito vaciado', 'info'); });
        document.getElementById('cliente-nombre')?.addEventListener('input', () => document.getElementById('g-cliente-nombre')?.classList.remove('error'));
        document.getElementById('cliente-telefono')?.addEventListener('input', () => document.getElementById('g-cliente-tel')?.classList.remove('error'));
        this.grid?.addEventListener('click', e => {
            const btn = e.target.closest('.card-btn-add');
            if (btn) {
                if (btn.disabled) return;
                const res = carrito.agregar(btn.dataset.id, null, this.productos);
                if (res.ok) { this.actualizarContador(); mostrarToast(`🛒 ${res.msg}`, 'ok'); const p = this.productos.find(p => p.id === btn.dataset.id); if (p && carrito.cantidadDe(p.id, null) >= p.stock) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-times-circle"></i> Agotado'; } }
                else { mostrarToast(`❌ ${res.msg}`, 'error'); }
                return;
            }
            const card = e.target.closest('.product-card');
            if (card) this.abrirDetalle(card.dataset.id);
        });
        this.cartItems?.addEventListener('click', e => {
            const btnA = e.target.closest('.btn-aumentar');
            const btnD = e.target.closest('.btn-disminuir');
            if (btnA && !btnA.disabled) { const variantId = btnA.dataset.variant === '' ? null : btnA.dataset.variant; carrito.aumentar(btnA.dataset.id, variantId, this.productos); this.actualizarContador(); this.renderCarrito(); this.renderProductos(); }
            if (btnD) { const variantId = btnD.dataset.variant === '' ? null : btnD.dataset.variant; carrito.disminuir(btnD.dataset.id, variantId); this.actualizarContador(); this.renderCarrito(); this.renderProductos(); if (carrito.cantidad === 0) mostrarToast('🛒 Carrito vacío', 'info'); }
        });
        document.getElementById('detalle-btn-cerrar')?.addEventListener('click', () => this.cerrarDetalle());
        document.getElementById('modal-detalle')?.addEventListener('click', e => { if (e.target === document.getElementById('modal-detalle')) this.cerrarDetalle(); });
        document.querySelectorAll('#estrellas-input i').forEach(star => {
            star.addEventListener('click', () => { this.estrellaSeleccionada = parseInt(star.dataset.val); this.actualizarEstrellas(this.estrellaSeleccionada); });
            star.addEventListener('mouseover', () => this.actualizarEstrellas(parseInt(star.dataset.val)));
            star.addEventListener('mouseout', () => this.actualizarEstrellas(this.estrellaSeleccionada));
        });
        document.getElementById('btn-enviar-resena')?.addEventListener('click', () => this.enviarResena());
    }
};
