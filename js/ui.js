// ui.js - Granma Market con filtros, envío y nombre expandible
import { supabase } from './supabase.js';
import { carrito } from './carrito.js';
import { CONFIG } from './config.js';
import { mostrarToast } from './modules/toast.js';
import { escapeHtml } from './utils/escape.js';
import { openAuthModal } from './auth.js';

// ==================== OPTIMIZACIÓN DE IMÁGENES ====================
function optimizarImagen(url, ancho = 400, alto = 400) {
    if (!url) return '';
    if (url.includes('unsplash.com')) {
        const baseUrl = url.split('?')[0];
        return `${baseUrl}?w=${ancho}&h=${alto}&fit=crop&auto=format&q=80`;
    }
    if (url.includes('cloudinary.com')) {
        return url.replace('/upload/', `/upload/w_${ancho},h_${alto},c_fill,q_80/`);
    }
    if (url.includes('?') && !url.includes('q=')) {
        return `${url}&q=80`;
    }
    return url;
}

// ==================== CACHÉ DE RESEÑAS ====================
const CACHE_TTL = 300000;

async function getResenasConCache(productoId) {
    const cacheKey = `resenas_${productoId}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(`${cacheKey}_time`);
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < CACHE_TTL) {
        return JSON.parse(cached);
    }
    const { data, error } = await supabase
        .from('reseñas')
        .select('*')
        .eq('productoid', productoId)
        .order('fecha', { ascending: false });
    if (error) throw error;
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(`${cacheKey}_time`, Date.now());
    return data;
}

export const UI = {
    grid: null,
    cartCount: null,
    cartModal: null,
    cartItems: null,
    cartTotal: null,
    productos: [],
    productoActualId: null,
    estrellaSeleccionada: 0,
    varianteActualIndex: null,
    enviandoPedido: false,
    categoriaActual: 'todos',
    municipioActual: 'todos',
    _datosPedidoPendiente: null,

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

    validarMonedaCarrito(items) {
        const monedas = [...new Set(items.map(i => i.moneda || 'CUP'))];
        if (monedas.length > 1) {
            mostrarToast('❌ No puedes combinar productos en CUP y USD en un mismo pedido. Separa la compra.', 'error');
            return false;
        }
        return true;
    },

    filtrarProductos() {
        let productosFiltrados = this.productos;

        if (this.categoriaActual !== 'todos') {
            productosFiltrados = productosFiltrados.filter(p => p.categoria === this.categoriaActual);
        }

        if (this.municipioActual !== 'todos') {
            productosFiltrados = productosFiltrados.filter(p => p.municipio === this.municipioActual);
        }

        this.renderProductos(productosFiltrados);
    },

    renderProductos(productosAMostrar = null) {
        const productos = productosAMostrar || this.productos;
        if (!this.grid) return;
        if (productos.length === 0) {
            this.grid.innerHTML = `<div class="grid-empty"><i class="fas fa-box-open"></i><p>No hay productos con estos filtros.</p></div>`;
            return;
        }
        const ofertas = productos.filter(p => p.enoferta && p.preciooferta);
        const normales = productos.filter(p => !p.enoferta || !p.preciooferta);

        const renderCard = (p) => {
            const enCarrito = carrito.cantidadDe(p.id, null);
            const precioReal = (p.enoferta && p.preciooferta) ? p.preciooferta : p.precio;
            const agotado = p.stock <= 0 || enCarrito >= p.stock;
            const stockBajo = !agotado && p.stock <= 3;
            const descuento = (p.enoferta && p.preciooferta) ? Math.round((1 - p.preciooferta / p.precio) * 100) : null;
            const imgOptimizada = optimizarImagen(p.imagen, 400, 400);

            const moneda = p.moneda || 'CUP';
            const textoMoneda = moneda === 'USD' ? ' USD' : ' CUP';
            const simbolo = '$';

            const municipioBadge = p.municipio
                ? `<span class="vendedor-municipio"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.municipio)}</span>`
                : '';

            return `
            <article class="product-card ${p.enoferta && p.preciooferta ? 'en-oferta' : ''}" data-id="${escapeHtml(p.id)}">
                ${descuento ? `<span class="card-badge-oferta">−${descuento}%</span>` : ''}
                ${stockBajo && !descuento ? `<span class="card-stock-badge">¡Solo ${p.stock}!</span>` : ''}
                <img src="${escapeHtml(imgOptimizada)}" alt="${escapeHtml(p.nombre)}" loading="lazy" onerror="this.src='https://placehold.co/400x400?text=Sin+imagen'">
                <div class="product-info">
                    <span class="vendedor"><i class="fas fa-user-circle"></i> ${escapeHtml(p.vendedor)}</span>
                    ${municipioBadge}
                    <h3>${escapeHtml(p.nombre)}</h3>
                    <div class="price-wrap">
                        ${descuento ? `<span class="price-original">${simbolo}${Number(p.precio).toLocaleString('es')}${textoMoneda}</span>` : ''}
                        <span class="price ${descuento ? 'price-oferta' : ''}">${simbolo}${Number(precioReal).toLocaleString('es')}${textoMoneda}</span>
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
            this.actualizarBotonQvaPay();
            return;
        }
        this.cartItems.innerHTML = items.map(item => {
            const puedeAumentar = item.cantidad < item.stockDisponible;
            const moneda = item.moneda || 'CUP';
            const textoMoneda = moneda === 'USD' ? ' USD' : ' CUP';
            const subtotal = item.precio * item.cantidad;
            return `<div class="cart-item" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${escapeHtml(item.nombre)}${escapeHtml(item.variantNombre)}</div>
                        <div class="cart-item-price">$${subtotal.toLocaleString('es')}${textoMoneda}</div>
                    </div>
                    <div class="qty-control">
                        <button class="qty-btn btn-disminuir" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}">−</button>
                        <span class="qty-num">${item.cantidad}</span>
                        <button class="qty-btn btn-aumentar" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}" ${!puedeAumentar ? 'disabled' : ''}>+</button>
                    </div>
                </div>`;
        }).join('');
        this.cartTotal.textContent = carrito.total(this.productos).toLocaleString('es');
        this.actualizarBotonQvaPay();
    },

    // ==================== QvaPay ====================
    actualizarBotonQvaPay() {
        const items = carrito.itemsConDatos(this.productos);
        if (items.length === 0) { this.removerBotonQvaPay(); return; }
        const todasUSD = items.every(item => (item.moneda || 'CUP') === 'USD');
        if (!todasUSD) { this.removerBotonQvaPay(); return; }
        const vendedoresUnicos = [...new Set(items.map(i => i.seller_id))];
        if (vendedoresUnicos.length !== 1) { this.removerBotonQvaPay(); return; }
        const vendedorId = vendedoresUnicos[0];
        supabase
            .from('profiles')
            .select('qvapay_enabled, qvapay_merchant_id')
            .eq('id', vendedorId)
            .single()
            .then(({ data, error }) => {
                const habilitado = !error && data?.qvapay_enabled && data?.qvapay_merchant_id;
                if (habilitado) this.agregarBotonQvaPay();
                else this.removerBotonQvaPay();
            })
            .catch(() => this.removerBotonQvaPay());
    },

    agregarBotonQvaPay() {
        let btn = document.getElementById('btn-qvapay');
        if (btn) return;
        const footer = document.querySelector('#cart-modal .modal-footer');
        if (!footer) return;
        btn = document.createElement('button');
        btn.id = 'btn-qvapay';
        btn.className = 'btn-primary';
        btn.style.background = 'var(--primary)';
        btn.style.marginBottom = '8px';
        btn.innerHTML = '<i class="fas fa-dollar-sign"></i> Pagar con QvaPay (dólar digital)';
        btn.addEventListener('click', () => this.iniciarPagoQvaPay());
        const whatsappBtn = document.getElementById('btn-whatsapp');
        if (whatsappBtn) footer.insertBefore(btn, whatsappBtn);
        else footer.appendChild(btn);
    },

    removerBotonQvaPay() {
        const btn = document.getElementById('btn-qvapay');
        if (btn) btn.remove();
    },

    async iniciarPagoQvaPay() {
        const items = carrito.itemsConDatos(this.productos);
        if (items.length === 0) { mostrarToast('Carrito vacío', 'warning'); return; }
        if (!this.validarMonedaCarrito(items)) return;
        const todasUSD = items.every(item => (item.moneda || 'CUP') === 'USD');
        if (!todasUSD) { mostrarToast('El pago con QvaPay solo está disponible para productos en USD.', 'error'); return; }
        const vendedoresUnicos = [...new Set(items.map(i => i.seller_id))];
        if (vendedoresUnicos.length !== 1) { mostrarToast('Pago con QvaPay solo disponible para pedidos de un solo vendedor', 'warning'); return; }
        const vendedorId = vendedoresUnicos[0];

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('qvapay_enabled, qvapay_merchant_id')
            .eq('id', vendedorId)
            .single();

        if (error || !profile?.qvapay_enabled || !profile?.qvapay_merchant_id) {
            mostrarToast('Este vendedor no acepta pagos con QvaPay', 'error');
            return;
        }

        const clienteNombre = document.getElementById('cliente-nombre')?.value.trim();
        if (!clienteNombre) { mostrarToast('Por favor ingresa tu nombre', 'error'); return; }

        const total = carrito.total(this.productos);
        const productosParaEnvio = items.map(item => ({
            id: item.id, variantId: item.variantId, nombre: item.nombre,
            cantidad: item.cantidad, precio: item.precio,
            moneda: item.moneda || 'CUP', vendedor_id: item.seller_id
        }));

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { mostrarToast('Debes iniciar sesión para pagar', 'error'); return; }

        mostrarToast('Creando orden de pago...', 'info');

        try {
            const response = await fetch(`${CONFIG.supabaseUrl}/functions/v1/create-qvapay-invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    cartItems: productosParaEnvio,
                    clienteNombre: clienteNombre,
                    vendedorId: vendedorId,
                    total: total
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al iniciar pago');

            if (result.checkout_url) {
                window.location.href = result.checkout_url;
            } else {
                throw new Error('No se recibió URL de pago');
            }
        } catch (err) {
            console.error(err);
            mostrarToast(err.message || 'Error al procesar pago', 'error');
        }
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
        this.varianteActualIndex = null;

        const modal = document.getElementById('modal-detalle');
        const monedaProducto = p.moneda || 'CUP';
        const textoMoneda = monedaProducto === 'USD' ? ' USD' : ' CUP';
        const simbolo = '$';

        const imagenPrincipal = p.imagen || '';
        const galeriaUrls = p.galeria || [];
        const todasLasImagenes = [imagenPrincipal, ...galeriaUrls].filter(url => url && url !== '');

        if (todasLasImagenes.length > 0) {
            document.getElementById('detalle-img').src = optimizarImagen(todasLasImagenes[0], 600, 600);
        } else {
            document.getElementById('detalle-img').src = 'https://placehold.co/600x600?text=Sin+imagen';
        }
        document.getElementById('detalle-img').alt = escapeHtml(p.nombre);

        const miniaturasContainer = document.getElementById('detalle-miniaturas');
        if (miniaturasContainer) {
            miniaturasContainer.innerHTML = '';
            if (todasLasImagenes.length > 1) {
                miniaturasContainer.style.display = 'flex';
                todasLasImagenes.forEach((url, index) => {
                    const thumb = document.createElement('img');
                    thumb.src = optimizarImagen(url, 80, 80);
                    thumb.alt = `${p.nombre} - imagen ${index + 1}`;
                    thumb.style.cssText = 'width:60px;height:60px;object-fit:cover;cursor:pointer;border-radius:6px;transition:border-color 0.2s;';
                    thumb.style.border = index === 0 ? '2px solid #064e3b' : '2px solid transparent';
                    thumb.addEventListener('click', () => {
                        document.getElementById('detalle-img').src = optimizarImagen(url, 600, 600);
                        document.querySelectorAll('.detalle-miniaturas img').forEach(img => img.style.borderColor = 'transparent');
                        thumb.style.borderColor = '#064e3b';
                    });
                    miniaturasContainer.appendChild(thumb);
                });
            } else {
                miniaturasContainer.style.display = 'none';
            }
        }

        const actualizarVista = (index = null) => {
            this.cerrarLightbox();
            this.varianteActualIndex = index;

            const variante = (index !== null && p.variantes?.[index]) ? p.variantes[index] : null;
            let precio = variante
                ? (variante.precio !== undefined && variante.precio !== null ? Number(variante.precio) : Number(p.precio))
                : Number(p.precio);
            if (isNaN(precio)) precio = 0;
            const stockVal = variante ? (variante.stock ?? p.stock) : p.stock;
            const imagenUrl = variante ? (variante.imagen || p.imagen) : p.imagen;
            const enC = carrito.cantidadDe(id, index);
            const agotado = stockVal <= 0 || enC >= stockVal;

            const img = document.getElementById('detalle-img');
            if (img) {
                img.style.opacity = '0';
                img.style.transform = 'scale(0.97)';
                setTimeout(() => {
                    img.src = optimizarImagen(imagenUrl, 600, 600);
                    img.style.transition = 'opacity .25s, transform .25s';
                    img.style.opacity = '1';
                    img.style.transform = 'scale(1)';
                }, 150);
            }

            const precioEl = document.getElementById('detalle-precio');
            if (precioEl) {
                const descuentoBase = (p.enoferta && p.preciooferta && !variante) ? Math.round((1 - Number(p.preciooferta) / Number(p.precio)) * 100) : null;
                if (descuentoBase && !variante) {
                    precioEl.innerHTML = `<span style="text-decoration:line-through;color:#aaa;font-size:0.9em">${simbolo}${Number(p.precio).toLocaleString('es')}${textoMoneda}</span> <span style="color:#e53935;font-weight:700"> ${simbolo}${Number(p.preciooferta).toLocaleString('es')}${textoMoneda}</span> <span style="background:#ffebee;color:#c62828;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px">−${descuentoBase}%</span>`;
                } else {
                    precioEl.textContent = `${simbolo}${precio.toLocaleString('es')}${textoMoneda}`;
                }
            }

            const stockEl = document.getElementById('detalle-stock');
            if (stockEl) {
                const stockRestante = Math.max(0, stockVal - enC);
                if (stockRestante <= 0) {
                    stockEl.textContent = 'Agotado';
                    stockEl.className = 'detalle-stock agotado';
                } else if (stockRestante <= 3) {
                    stockEl.textContent = `¡Solo quedan ${stockRestante}!`;
                    stockEl.className = 'detalle-stock low';
                } else {
                    stockEl.textContent = `${stockRestante} disponibles`;
                    stockEl.className = 'detalle-stock ok';
                }
            }

            const btnAdd = document.getElementById('detalle-btn-add');
            if (btnAdd) {
                btnAdd.disabled = agotado;
                btnAdd.innerHTML = agotado ? '<i class="fas fa-times-circle"></i> Sin stock' : '<i class="fas fa-cart-plus"></i> Añadir al carrito';
            }
        };

        // Vendedor + municipio
        const vendedorEl = document.getElementById('detalle-vendedor');
        if (vendedorEl) {
            vendedorEl.innerHTML = `${escapeHtml(p.vendedor)}${p.municipio ? ` · <i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.municipio)}` : ''}`;
        }

        // ========== NOMBRE CON "VER MÁS" ==========
        const nombreEl = document.getElementById('detalle-nombre');
        const toggleEl = document.getElementById('detalle-nombre-toggle');
        const toggleTexto = toggleEl?.querySelector('.detalle-nombre-toggle-texto');

        if (nombreEl) {
            nombreEl.textContent = p.nombre;
            nombreEl.classList.remove('expandido');
            nombreEl.classList.add('colapsado');

            // Resetear el botón
            if (toggleEl) {
                toggleEl.classList.remove('visible', 'expandido');
                if (toggleTexto) toggleTexto.textContent = 'Ver más';
            }

            // Detectar si el texto se desborda después del render
            setTimeout(() => {
                if (!toggleEl || !nombreEl) return;

                const alturaCompleta = nombreEl.scrollHeight;
                const alturaLimitada = nombreEl.clientHeight;

                if (alturaCompleta > alturaLimitada + 2) {
                    toggleEl.classList.add('visible');

                    const nuevoHandler = () => {
                        const expandido = nombreEl.classList.contains('expandido');

                        if (expandido) {
                            // Colapsar
                            nombreEl.classList.remove('expandido');
                            nombreEl.classList.add('colapsado');
                            toggleEl.classList.remove('expandido');
                            if (toggleTexto) toggleTexto.textContent = 'Ver más';
                            nombreEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            // Expandir
                            nombreEl.classList.remove('colapsado');
                            nombreEl.classList.add('expandido');
                            toggleEl.classList.add('expandido');
                            if (toggleTexto) toggleTexto.textContent = 'Ver menos';
                        }
                    };

                    // Clonar para limpiar listeners antiguos
                    const clon = toggleEl.cloneNode(true);
                    toggleEl.parentNode.replaceChild(clon, toggleEl);
                    clon.addEventListener('click', nuevoHandler);
                }
            }, 50);
        }
        // ===========================================

        const detalleImg = document.getElementById('detalle-img');
        detalleImg.style.cursor = 'pointer';
        detalleImg.onclick = () => this.abrirLightbox();

        const contenedor = document.getElementById('detalle-variantes');
        contenedor.innerHTML = `<div class="variantes-titulo"><i class="fas fa-palette"></i> Opciones disponibles:</div><div class="variantes-grid" id="variantes-grid"></div>`;
        const grid = contenedor.querySelector('#variantes-grid');

        const baseCard = document.createElement('div');
        baseCard.className = 'variante-card';
        if (this.varianteActualIndex === null) baseCard.classList.add('selected');
        baseCard.dataset.index = '-1';
        baseCard.innerHTML = `<div class="variante-imagen"><img src="${optimizarImagen(p.imagen, 80, 80)}" alt="${escapeHtml(p.nombre)}" onerror="this.src='https://placehold.co/80x80?text=?'"></div>`;
        baseCard.addEventListener('click', () => {
            if (baseCard.classList.contains('selected')) return;
            document.querySelectorAll('.variante-card').forEach(c => c.classList.remove('selected'));
            baseCard.classList.add('selected');
            this.varianteActualIndex = null;
            actualizarVista(null);
        });
        grid.appendChild(baseCard);

        if (p.variantes && p.variantes.length > 0) {
            p.variantes.forEach((v, i) => {
                const imagenVar = v.imagen || p.imagen;
                const card = document.createElement('div');
                card.className = 'variante-card';
                if (this.varianteActualIndex === i) card.classList.add('selected');
                card.dataset.index = i;
                card.innerHTML = `<div class="variante-imagen"><img src="${optimizarImagen(imagenVar, 80, 80)}" alt="${escapeHtml(v.nombre)}" onerror="this.src='https://placehold.co/80x80?text=?'"></div>`;
                card.addEventListener('click', () => {
                    if (card.classList.contains('selected')) return;
                    document.querySelectorAll('.variante-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.varianteActualIndex = i;
                    actualizarVista(i);
                });
                grid.appendChild(card);
            });
        }

        contenedor.style.display = 'block';

        const btnAdd = document.getElementById('detalle-btn-add');
        btnAdd.onclick = () => {
            const variantId = this.varianteActualIndex !== null ? this.varianteActualIndex : null;
            const res = carrito.agregar(id, variantId, this.productos);
            if (res.ok) {
                this.actualizarContador();
                mostrarToast(`🛒 ${res.msg}`, 'ok');
                actualizarVista(this.varianteActualIndex);
                const originalText = btnAdd.innerHTML;
                btnAdd.innerHTML = '<i class="fas fa-check"></i> Añadido';
                setTimeout(() => { if (!btnAdd.disabled) btnAdd.innerHTML = originalText; }, 1500);
            } else {
                mostrarToast(`❌ ${res.msg}`, 'error');
            }
        };

        const btnShare = document.getElementById('detalle-btn-share');
        if (btnShare) btnShare.onclick = () => this.compartirProducto();

        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';

        document.getElementById('resena-nombre').value = '';
        document.getElementById('resena-texto').value = '';
        this.estrellaSeleccionada = 0;
        this.actualizarEstrellas(0);
        await this.cargarResenas(id);

        actualizarVista(this.varianteActualIndex);
    },

    compartirProducto() {
        const producto = this.productos.find(p => p.id === this.productoActualId);
        if (!producto) return;
        const precioFinal = (producto.enoferta && producto.preciooferta) ? producto.preciooferta : producto.precio;
        const url = `${window.location.origin}/producto/${this.productoActualId}`;
        const moneda = producto.moneda || 'CUP';
        const textoMoneda = moneda === 'USD' ? 'USD' : 'CUP';
        const municipioTxt = producto.municipio ? `\n📍 ${producto.municipio}` : '';
        const texto = `🛍️ *${producto.nombre}* - $${precioFinal.toLocaleString('es')} ${textoMoneda}${municipioTxt}\n\nMira este producto en Granma Market:\n${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
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
            const data = await getResenasConCache(productoId);
            count.textContent = data.length > 0 ? `(${data.length})` : '';
            if (data.length === 0) {
                lista.innerHTML = '<div class="resenas-empty"><i class="fas fa-comment-slash"></i><br>Sin reseñas aún. ¡Sé el primero!</div>';
                return;
            }
            lista.innerHTML = data.map(r => `<div class="resena-item"><div class="resena-header"><span class="resena-autor">${escapeHtml(r.nombre)}</span><span class="resena-estrellas">${'★'.repeat(Number(r.estrellas))}${'☆'.repeat(5 - Number(r.estrellas))}</span></div><div class="resena-texto">${escapeHtml(r.texto)}</div><div class="resena-fecha">${new Date(r.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>`).join('');
        } catch (err) {
            lista.innerHTML = '<div class="resenas-empty">No se pudieron cargar las reseñas.</div>';
        }
    },

    async enviarResena() {
        const nombre = document.getElementById('resena-nombre').value.trim();
        const texto = document.getElementById('resena-texto').value.trim();
        const estrellas = this.estrellaSeleccionada;
        if (!nombre || !texto || estrellas === 0) {
            mostrarToast('⚠️ Completa nombre, estrellas y opinión', 'warning');
            return;
        }
        const btn = document.getElementById('btn-enviar-resena');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
        try {
            const { error } = await supabase.from('reseñas').insert([{
                productoid: this.productoActualId,
                nombre: nombre.slice(0, 30),
                texto: texto.slice(0, 200),
                estrellas: Math.min(5, Math.max(1, estrellas)),
                fecha: new Date().toISOString()
            }]);
            if (error) throw error;
            mostrarToast('✅ Reseña publicada', 'ok');
            document.getElementById('resena-nombre').value = '';
            document.getElementById('resena-texto').value = '';
            this.estrellaSeleccionada = 0;
            this.actualizarEstrellas(0);
            localStorage.removeItem(`resenas_${this.productoActualId}`);
            localStorage.removeItem(`resenas_${this.productoActualId}_time`);
            await this.cargarResenas(this.productoActualId);
        } catch (err) {
            mostrarToast('❌ Error al publicar reseña', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar reseña';
        }
    },

    actualizarEstrellas(valor) {
        document.querySelectorAll('#estrellas-input i').forEach((star, i) => star.classList.toggle('activa', i < valor));
    },

    // ==================== PEDIDOS ====================
    async guardarPedido(items, datosEnvio) {
        const total = items.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
        const seller_id = items[0]?.seller_id;
        if (!seller_id) return null;

        const productosData = items.map(it => ({
            id: it.id, variantId: it.variantId, nombre: it.nombre,
            cantidad: it.cantidad, precio: it.precio,
            moneda: it.moneda || 'CUP', vendedor_id: seller_id
        }));

        const { data, error } = await supabase
            .from('pedidos')
            .insert({
                cliente_nombre: datosEnvio.cliente_nombre,
                cliente_telefono: datosEnvio.cliente_telefono,
                municipio_entrega: datosEnvio.municipio_entrega,
                direccion_entrega: datosEnvio.direccion_entrega,
                referencia_entrega: datosEnvio.referencia_entrega,
                notas_envio: datosEnvio.notas_envio,
                total: total,
                productos: productosData,
                vendedor_id: seller_id,
                status: 'pendiente',
                envio_confirmado: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error guardando pedido:', error);
            return null;
        }
        return data.id;
    },

    mostrarModalWhatsApp(vendedores, pedidosIds, datosEnvio) {
        let modal = document.getElementById('modal-whatsapp');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-whatsapp';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
            <div class="modal-box" style="max-width: 420px;">
                <div class="modal-header">
                    <h2><i class="fab fa-whatsapp"></i> Confirmar pedido</h2>
                    <button class="modal-close" id="close-whatsapp-modal">&times;</button>
                </div>
                <div class="modal-body" id="whatsapp-links"></div>
            </div>
        `;
            document.body.appendChild(modal);
            document.getElementById('close-whatsapp-modal')?.addEventListener('click', () => {
                modal.setAttribute('hidden', '');
                document.body.style.overflow = '';
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.setAttribute('hidden', '');
            });
        }

        const linksContainer = document.getElementById('whatsapp-links');
        linksContainer.innerHTML = `
            <div style="background:#f8f9fa; padding:12px; border-radius:10px; margin-bottom:1rem; font-size:0.85rem;">
                <p><strong>👤 Comprador:</strong> ${escapeHtml(datosEnvio.cliente_nombre)}</p>
                <p><strong>📞 Teléfono:</strong> ${escapeHtml(datosEnvio.cliente_telefono)}</p>
                <p><strong>📍 Municipio:</strong> ${escapeHtml(datosEnvio.municipio_entrega)}</p>
                <p><strong>🏠 Dirección:</strong> ${escapeHtml(datosEnvio.direccion_entrega)}</p>
                ${datosEnvio.referencia_entrega ? `<p><strong>🧭 Referencia:</strong> ${escapeHtml(datosEnvio.referencia_entrega)}</p>` : ''}
            </div>
            <p style="margin-bottom: 1rem; font-size:0.85rem;">Selecciona el vendedor para enviar el pedido por WhatsApp:</p>
        `;

        vendedores.forEach((grupo, i) => {
            const totalGrupo = grupo.items.reduce((s, it) => s + it.precio * it.cantidad, 0);
            const pedidoId = pedidosIds[i];
            const monedaGrupo = grupo.items[0]?.moneda || 'CUP';
            const textoMonedaGrupo = monedaGrupo === 'USD' ? 'USD' : 'CUP';

            let texto = `🛍️ *Nuevo Pedido — Granma Market*\n\n`;
            texto += `👤 *Comprador:* ${datosEnvio.cliente_nombre}\n`;
            texto += `📞 *Teléfono:* ${datosEnvio.cliente_telefono}\n`;
            texto += `📍 *Entregar en:* ${datosEnvio.municipio_entrega}\n`;
            texto += `🏠 *Dirección:* ${datosEnvio.direccion_entrega}\n`;
            if (datosEnvio.referencia_entrega) texto += `🧭 *Referencia:* ${datosEnvio.referencia_entrega}\n`;
            if (datosEnvio.notas_envio) texto += `📝 *Notas:* ${datosEnvio.notas_envio}\n`;
            texto += `\n📦 *Productos:*\n`;

            grupo.items.forEach(item => {
                const moneda = item.moneda || 'CUP';
                const textoMoneda = moneda === 'USD' ? 'USD' : 'CUP';
                texto += `• ${item.nombre}${item.variantNombre} x${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString('es')} ${textoMoneda}\n`;
            });

            texto += `\n💰 *Subtotal productos: $${totalGrupo.toLocaleString('es')} ${textoMonedaGrupo}*\n`;
            texto += `🚚 *Costo de envío:* Por confirmar\n`;
            if (vendedores.length > 1) texto += `\n_Pedido dividido entre ${vendedores.length} vendedores._\n`;
            texto += `\n🔗 *Confirmar pedido:* ${window.location.origin}/confirmar.html?pedido=${pedidoId}\n`;
            texto += `\nHola, confirma este pedido para continuar. 😊`;

            const link = `https://wa.me/${grupo.telefono}?text=${encodeURIComponent(texto)}`;
            linksContainer.innerHTML += `
            <a href="${link}" target="_blank" class="btn-whatsapp" style="display: block; margin-bottom: 0.75rem; text-align: center; text-decoration: none;">
                <i class="fab fa-whatsapp"></i> ${escapeHtml(grupo.vendedor)} - $${totalGrupo.toLocaleString('es')} ${textoMonedaGrupo}
            </a>
        `;
        });
        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    },

    async enviarWhatsApp() {
        if (this.enviandoPedido) {
            mostrarToast('⏳ Procesando pedido, espera...', 'warning');
            return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            mostrarToast('⚠️ Debes iniciar sesión para realizar un pedido', 'warning');
            openAuthModal();
            return;
        }
        const items = carrito.itemsConDatos(this.productos);
        if (!this.validarMonedaCarrito(items)) return;
        if (items.length === 0) {
            mostrarToast('⚠️ Tu carrito está vacío', 'warning');
            return;
        }
        const clienteNombre = document.getElementById('cliente-nombre')?.value.trim();
        if (!clienteNombre) {
            mostrarToast('📝 Por favor, ingresa tu nombre primero', 'error');
            return;
        }

        this._datosPedidoPendiente = { items, clienteNombre };

        document.getElementById('envio-nombre').value = clienteNombre;
        document.getElementById('envio-telefono').value = '';
        document.getElementById('envio-municipio').value = '';
        document.getElementById('envio-direccion').value = '';
        document.getElementById('envio-referencia').value = '';
        document.getElementById('envio-notas').value = '';

        this.cerrarModal();
        const modalEnvio = document.getElementById('modal-envio');
        modalEnvio.removeAttribute('hidden');
        modalEnvio.classList.remove('hidden');
        modalEnvio.classList.add('flex');
        document.body.style.overflow = 'hidden';
    },

    async confirmarYEnviarPedido() {
        const nombre = document.getElementById('envio-nombre').value.trim();
        const telefono = document.getElementById('envio-telefono').value.trim();
        const municipio = document.getElementById('envio-municipio').value;
        const direccion = document.getElementById('envio-direccion').value.trim();
        const referencia = document.getElementById('envio-referencia').value.trim();
        const notas = document.getElementById('envio-notas').value.trim();

        if (!nombre) { mostrarToast('Escribe tu nombre', 'error'); return; }
        if (!telefono || !/^5[0-9]{7}$/.test(telefono.replace(/\s+/g, ''))) {
            mostrarToast('Teléfono cubano inválido (formato: 5XXXXXXX)', 'error'); return;
        }
        if (!municipio) { mostrarToast('Selecciona tu municipio', 'error'); return; }
        if (!direccion) { mostrarToast('Escribe tu dirección exacta', 'error'); return; }

        const btn = document.getElementById('envio-confirmar');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            const { items } = this._datosPedidoPendiente;
            const datosEnvio = {
                cliente_nombre: nombre,
                cliente_telefono: telefono,
                municipio_entrega: municipio,
                direccion_entrega: direccion,
                referencia_entrega: referencia || null,
                notas_envio: notas || null
            };

            const porVendedor = {};
            items.forEach(item => {
                const sellerId = item.seller_id;
                if (!porVendedor[sellerId]) {
                    porVendedor[sellerId] = {
                        seller_id: sellerId,
                        vendedor: item.vendedor,
                        telefono: item.telefonovendedor || CONFIG.whatsapp,
                        items: []
                    };
                }
                porVendedor[sellerId].items.push(item);
            });
            const vendedores = Object.values(porVendedor);

            const pedidosIds = [];
            for (const grupo of vendedores) {
                const id = await this.guardarPedido(grupo.items, datosEnvio);
                if (id) pedidosIds.push(id);
                else throw new Error('Error al guardar pedido');
            }

            const modalEnvio = document.getElementById('modal-envio');
            modalEnvio.setAttribute('hidden', '');
            modalEnvio.classList.add('hidden');
            modalEnvio.classList.remove('flex');
            document.body.style.overflow = '';

            this.mostrarModalWhatsApp(vendedores, pedidosIds, datosEnvio);

            carrito.vaciar();
            this.actualizarContador();
            this.renderProductos();
            this.actualizarBotonQvaPay();
            this._datosPedidoPendiente = null;

            mostrarToast('✅ Pedido enviado. Esperando confirmación del costo de envío.', 'ok');
        } catch (err) {
            console.error(err);
            mostrarToast(`❌ Error al procesar pedido: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar pedido';
        }
    },

    bindEventos() {
        document.getElementById('cart-btn')?.addEventListener('click', () => this.abrirModal());
        document.getElementById('modal-close')?.addEventListener('click', () => this.cerrarModal());
        this.cartModal?.addEventListener('click', e => { if (e.target === this.cartModal) this.cerrarModal(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (!this.cartModal?.hasAttribute('hidden')) this.cerrarModal();
                if (!document.getElementById('modal-detalle')?.hasAttribute('hidden')) this.cerrarDetalle();
            }
        });
        document.getElementById('btn-whatsapp')?.addEventListener('click', () => this.enviarWhatsApp());
        document.getElementById('btn-clear')?.addEventListener('click', () => {
            if (carrito.cantidad === 0) {
                mostrarToast('⚠️ El carrito ya está vacío', 'warning');
                return;
            }
            carrito.vaciar();
            this.actualizarContador();
            this.renderCarrito();
            this.renderProductos();
            this.actualizarBotonQvaPay();
            mostrarToast('🗑️ Carrito vaciado', 'info');
        });

        this.grid?.addEventListener('click', e => {
            const btn = e.target.closest('.card-btn-add');
            if (btn) {
                if (btn.disabled) return;
                const id = btn.dataset.id;
                const res = carrito.agregar(id, null, this.productos);
                if (res.ok) {
                    this.actualizarContador();
                    mostrarToast(`🛒 ${res.msg}`, 'ok');
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Añadido';
                    setTimeout(() => {
                        const p = this.productos.find(p => p.id === id);
                        if (p && carrito.cantidadDe(p.id, null) >= p.stock) {
                            btn.disabled = true;
                            btn.innerHTML = '<i class="fas fa-times-circle"></i> Agotado';
                        } else {
                            btn.innerHTML = originalText;
                        }
                    }, 1500);
                } else {
                    mostrarToast(`❌ ${res.msg}`, 'error');
                }
                return;
            }
            const card = e.target.closest('.product-card');
            if (card) this.abrirDetalle(card.dataset.id);
        });

        this.cartItems?.addEventListener('click', e => {
            const btnA = e.target.closest('.btn-aumentar');
            const btnD = e.target.closest('.btn-disminuir');
            if (btnA && !btnA.disabled) {
                const variantId = btnA.dataset.variant === '' ? null : btnA.dataset.variant;
                const vid = (variantId && variantId !== '') ? parseInt(variantId) : null;
                carrito.aumentar(btnA.dataset.id, vid, this.productos);
                this.actualizarContador();
                this.renderCarrito();
                this.renderProductos();
                this.actualizarBotonQvaPay();
            }
            if (btnD) {
                const variantId = btnD.dataset.variant === '' ? null : btnD.dataset.variant;
                const vid = (variantId && variantId !== '') ? parseInt(variantId) : null;
                carrito.disminuir(btnD.dataset.id, vid);
                this.actualizarContador();
                this.renderCarrito();
                this.renderProductos();
                this.actualizarBotonQvaPay();
                if (carrito.cantidad === 0) mostrarToast('🛒 Carrito vacío', 'info');
            }
        });

        document.getElementById('detalle-btn-cerrar')?.addEventListener('click', () => this.cerrarDetalle());
        document.getElementById('modal-detalle')?.addEventListener('click', e => {
            if (e.target === document.getElementById('modal-detalle')) this.cerrarDetalle();
        });

        document.querySelectorAll('#estrellas-input i').forEach(star => {
            star.addEventListener('click', () => {
                this.estrellaSeleccionada = parseInt(star.dataset.val);
                this.actualizarEstrellas(this.estrellaSeleccionada);
            });
            star.addEventListener('mouseover', () => this.actualizarEstrellas(parseInt(star.dataset.val)));
            star.addEventListener('mouseout', () => this.actualizarEstrellas(this.estrellaSeleccionada));
        });

        document.getElementById('btn-enviar-resena')?.addEventListener('click', () => this.enviarResena());

        document.querySelectorAll('.filtro-btn[data-categoria]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filtro-btn[data-categoria]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.categoriaActual = btn.dataset.categoria;
                this.filtrarProductos();
            });
        });

        document.querySelectorAll('.filtro-btn[data-municipio]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filtro-btn[data-municipio]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.municipioActual = btn.dataset.municipio;
                this.filtrarProductos();
            });
        });

        // ========== MODAL DE ENVÍO ==========
        const cerrarModalEnvio = () => {
            const modalEnvio = document.getElementById('modal-envio');
            modalEnvio.setAttribute('hidden', '');
            modalEnvio.classList.add('hidden');
            modalEnvio.classList.remove('flex');
            document.body.style.overflow = '';
            this._datosPedidoPendiente = null;
        };
        document.getElementById('envio-cerrar')?.addEventListener('click', cerrarModalEnvio);
        document.getElementById('envio-cancelar')?.addEventListener('click', cerrarModalEnvio);
        document.getElementById('modal-envio')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-envio')) cerrarModalEnvio();
        });
        document.getElementById('envio-confirmar')?.addEventListener('click', () => this.confirmarYEnviarPedido());
    }
};