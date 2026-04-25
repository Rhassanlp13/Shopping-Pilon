// ui.js - Versión con filtros por categoría y pago con QvaPay
import { supabase } from './supabase.js';
import { carrito } from './carrito.js';
import { CONFIG } from './config.js';
import { mostrarToast } from './modules/toast.js';
import { escapeHtml } from './utils/escape.js';

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
    categoriaActual: 'todos', // Estado del filtro

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

    // Filtrar productos según categoría seleccionada
    filtrarProductos() {
        let productosFiltrados = this.productos;
        if (this.categoriaActual !== 'todos') {
            productosFiltrados = this.productos.filter(p => p.categoria === this.categoriaActual);
        }
        this.renderProductos(productosFiltrados);
    },

    // Renderiza productos, acepta array opcional para filtrado
    renderProductos(productosAMostrar = null) {
        const productos = productosAMostrar || this.productos;
        if (!this.grid) return;
        if (productos.length === 0) {
            this.grid.innerHTML = `<div class="grid-empty"><i class="fas fa-box-open"></i><p>No hay productos en esta categoría.</p></div>`;
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
            return `
                <article class="product-card ${p.enoferta && p.preciooferta ? 'en-oferta' : ''}" data-id="${escapeHtml(p.id)}">
                    ${descuento ? `<span class="card-badge-oferta">−${descuento}%</span>` : ''}
                    ${stockBajo && !descuento ? `<span class="card-stock-badge">¡Solo ${p.stock}!</span>` : ''}
                    <img src="${escapeHtml(imgOptimizada)}" alt="${escapeHtml(p.nombre)}" loading="lazy" onerror="this.src='https://placehold.co/400x400?text=Sin+imagen'">
                    <div class="product-info">
                        <span class="vendedor"><i class="fas fa-user-circle"></i> ${escapeHtml(p.vendedor)}</span>
                        <h3>${escapeHtml(p.nombre)}</h3>
                        <div class="price-wrap">
                            ${descuento ? `<span class="price-original">$${Number(p.precio).toLocaleString('es')}</span>` : ''}
                            <span class="price ${descuento ? 'price-oferta' : ''}">$${Number(precioReal).toLocaleString('es')}</span>
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
            this.actualizarBotonQvaPay(); // 👈 NUEVO
            return;
        }
        this.cartItems.innerHTML = items.map(item => {
            const puedeAumentar = item.cantidad < item.stockDisponible;
            return `<div class="cart-item" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}"><div class="cart-item-info"><div class="cart-item-name">${escapeHtml(item.nombre)}${escapeHtml(item.variantNombre)}</div><div class="cart-item-price">$${(item.precio * item.cantidad).toLocaleString('es')} CUP</div></div><div class="qty-control"><button class="qty-btn btn-disminuir" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}">−</button><span class="qty-num">${item.cantidad}</span><button class="qty-btn btn-aumentar" data-id="${escapeHtml(item.id)}" data-variant="${escapeHtml(item.variantId ?? '')}" ${!puedeAumentar ? 'disabled' : ''}>+</button></div></div>`;
        }).join('');
        this.cartTotal.textContent = carrito.total(this.productos).toLocaleString('es');
        this.actualizarBotonQvaPay(); // 👈 NUEVO
    },

    // ==================== QvaPay ====================
    actualizarBotonQvaPay() {
        const items = carrito.itemsConDatos(this.productos);
        if (items.length === 0) {
            this.removerBotonQvaPay();
            return;
        }
        const vendedoresUnicos = [...new Set(items.map(i => i.seller_id))];
        if (vendedoresUnicos.length !== 1) {
            this.removerBotonQvaPay();
            return;
        }
        const vendedorId = vendedoresUnicos[0];
        supabase
            .from('profiles')
            .select('qvapay_enabled, qvapay_merchant_id')
            .eq('id', vendedorId)
            .single()
            .then(({ data, error }) => {
                const habilitado = !error && data?.qvapay_enabled && data?.qvapay_merchant_id;
                if (habilitado) {
                    this.agregarBotonQvaPay();
                } else {
                    this.removerBotonQvaPay();
                }
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
        btn.style.background = '#1a237e';
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
        if (items.length === 0) {
            mostrarToast('Carrito vacío', 'warning');
            return;
        }
        const vendedoresUnicos = [...new Set(items.map(i => i.seller_id))];
        if (vendedoresUnicos.length !== 1) {
            mostrarToast('Pago con QvaPay solo disponible para pedidos de un solo vendedor', 'warning');
            return;
        }
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
        if (!clienteNombre) {
            mostrarToast('Por favor ingresa tu nombre', 'error');
            return;
        }

        const total = carrito.total(this.productos);
        const productosParaEnvio = items.map(item => ({
            id: item.id,
            variantId: item.variantId,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: item.precio,
            vendedor_id: item.seller_id
        }));

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            mostrarToast('Debes iniciar sesión para pagar', 'error');
            return;
        }

        mostrarToast('Creando orden de pago...', 'info');

        try {
            const SUPABASE_URL = 'https://xistchuskgnmjrzlntve.supabase.co';
            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-qvapay-invoice`, {
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
    // ==================== Fin QvaPay ====================

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
                    precioEl.innerHTML = `<span style="text-decoration:line-through;color:#aaa;font-size:0.9em">$${Number(p.precio).toLocaleString('es')}</span> <span style="color:#e53935;font-weight:700"> $${Number(p.preciooferta).toLocaleString('es')}</span> <span style="background:#ffebee;color:#c62828;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px">−${descuentoBase}%</span>`;
                } else {
                    precioEl.textContent = precio.toLocaleString('es');
                }
            }

            const stockEl = document.getElementById('detalle-stock');
            if (stockEl) {
                const enCarrito = carrito.cantidadDe(id, index); // ya existe como `enC`
                const stockRestante = Math.max(0, stockVal - enCarrito);

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

        document.getElementById('detalle-img').src = optimizarImagen(p.imagen, 600, 600);
        document.getElementById('detalle-img').alt = escapeHtml(p.nombre);
        document.getElementById('detalle-vendedor').textContent = p.vendedor;
        document.getElementById('detalle-nombre').textContent = p.nombre;

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
        baseCard.innerHTML = `<div class="variante-imagen"><img src="${optimizarImagen(p.imagen, 80, 80)}" alt="${escapeHtml(p.nombre)}" onerror="this.src='https://placehold.co/80x80?text=?'"></div><div class="variante-info"><div class="variante-nombre">${escapeHtml(p.nombre)}</div><div class="variante-precio">$${Number(p.precio).toLocaleString('es')}</div><div class="variante-stock">${p.stock > 0 ? `${p.stock} disponibles` : 'Agotado'}</div></div>`;
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
                card.innerHTML = `<div class="variante-imagen"><img src="${optimizarImagen(imagenVar, 80, 80)}" alt="${escapeHtml(v.nombre)}" onerror="this.src='https://placehold.co/80x80?text=?'"></div><div class="variante-info"><div class="variante-nombre">${escapeHtml(v.nombre)}</div>${v.precio ? `<div class="variante-precio">$${v.precio.toLocaleString('es')}</div>` : ''}<div class="variante-stock">${v.stock > 0 ? `${v.stock} disponibles` : 'Agotado'}</div></div>`;
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
                setTimeout(() => {
                    if (!btnAdd.disabled) btnAdd.innerHTML = originalText;
                }, 1500);

                const targetCard = document.querySelector(`.product-card[data-id="${id}"]`);
                if (targetCard) {
                    const btnGrid = targetCard.querySelector('.card-btn-add');
                    if (p) {
                        const cantidadEnCarrito = carrito.cantidadDe(id, null);
                        const agotado = p.stock <= 0 || cantidadEnCarrito >= p.stock;
                        if (btnGrid) {
                            btnGrid.disabled = agotado;
                            btnGrid.innerHTML = agotado ? '<i class="fas fa-times-circle"></i> Agotado' : '<i class="fas fa-cart-plus"></i> Añadir';
                        }
                        const existingBadge = targetCard.querySelector('.card-stock-badge');
                        if (p.stock > 0 && p.stock <= 3 && !agotado) {
                            if (!existingBadge) {
                                const badge = document.createElement('span');
                                badge.className = 'card-stock-badge';
                                badge.textContent = `¡Solo ${p.stock}!`;
                                targetCard.querySelector('.product-info')?.prepend(badge);
                            } else {
                                existingBadge.textContent = `¡Solo ${p.stock}!`;
                            }
                        } else if (existingBadge) {
                            existingBadge.remove();
                        }
                    }
                }
            } else {
                mostrarToast(`❌ ${res.msg}`, 'error');
            }
        };

        const btnShare = document.getElementById('detalle-btn-share');
        if (btnShare) {
            btnShare.onclick = () => this.compartirProducto();
        }

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
        // ✅ Nueva ruta amigable para compartir con imagen
        const url = `${window.location.origin}/producto/${this.productoActualId}`;
        const texto = `🛍️ *${producto.nombre}* - $${precioFinal.toLocaleString('es')} CUP\n\nMira este producto en Shopping Pilón:\n${url}`;
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

    async guardarPedido(items, clienteNombre, clienteTelefono) {
        const total = items.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
        const seller_id = items[0]?.seller_id;
        if (!seller_id) return null;

        const productosData = items.map(it => ({
            id: it.id,
            variantId: it.variantId,
            nombre: it.nombre,
            cantidad: it.cantidad,
            precio: it.precio,
            vendedor_id: seller_id
        }));

        const { data, error } = await supabase
            .from('pedidos')
            .insert({
                cliente_nombre: clienteNombre,
                cliente_telefono: clienteTelefono,
                total: total,
                productos: productosData,
                vendedor_id: seller_id,
                status: 'pendiente'
            })
            .select()
            .single();

        if (error) {
            console.error('Error guardando pedido:', error);
            return null;
        }
        return data.id;
    },

    mostrarModalWhatsApp(vendedores, pedidosIds, clienteNombre) {
        let modal = document.getElementById('modal-whatsapp');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-whatsapp';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-box" style="max-width: 400px;">
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
        linksContainer.innerHTML = `<p style="margin-bottom: 0.5rem;"><strong>👤 Comprador:</strong> ${escapeHtml(clienteNombre)}</p>`;
        linksContainer.innerHTML += '<p style="margin-bottom: 1rem;">Selecciona el vendedor para enviar el pedido por WhatsApp:</p>';

        vendedores.forEach((grupo, i) => {
            const totalGrupo = grupo.items.reduce((s, it) => s + it.precio * it.cantidad, 0);
            const pedidoId = pedidosIds[i];
            let texto = `🛍️ *Nuevo Pedido — Shopping Pilón*\n\n`;
            texto += `👤 *Comprador:* ${clienteNombre}\n`;
            texto += `📦 *Productos:*\n`;
            grupo.items.forEach(item => {
                texto += `• ${item.nombre}${item.variantNombre} x${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString('es')} CUP\n`;
            });
            texto += `\n💰 *Total: $${totalGrupo.toLocaleString('es')} CUP*\n`;
            if (vendedores.length > 1) texto += `\n_Pedido dividido entre ${vendedores.length} vendedores._\n`;
            texto += `\n🔗 *Confirmar pedido:* ${window.location.origin}/confirmar.html?pedido=${pedidoId}\n`;
            texto += `\nHola, confirma este pedido para continuar. 😊`;

            const link = `https://wa.me/${grupo.telefono}?text=${encodeURIComponent(texto)}`;
            linksContainer.innerHTML += `
                <a href="${link}" target="_blank" class="btn-whatsapp" style="display: block; margin-bottom: 0.75rem; text-align: center; text-decoration: none;">
                    <i class="fab fa-whatsapp"></i> ${escapeHtml(grupo.vendedor)} - $${totalGrupo.toLocaleString('es')}
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

        const items = carrito.itemsConDatos(this.productos);
        if (items.length === 0) {
            mostrarToast('⚠️ Tu carrito está vacío', 'warning');
            return;
        }

        const clienteNombre = document.getElementById('cliente-nombre')?.value.trim();
        if (!clienteNombre) {
            mostrarToast('📝 Por favor, ingresa tu nombre', 'error');
            return;
        }
        const clienteTelefono = "Enviado por WhatsApp";

        this.enviandoPedido = true;

        try {
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
                const id = await this.guardarPedido(grupo.items, clienteNombre, clienteTelefono);
                if (id) pedidosIds.push(id);
                else throw new Error('Error al guardar pedido');
            }

            this.mostrarModalWhatsApp(vendedores, pedidosIds, clienteNombre);

            carrito.vaciar();
            this.actualizarContador();
            this.renderProductos();
            this.cerrarModal();
            this.actualizarBotonQvaPay(); // 👈 NUEVO
            mostrarToast(`✅ Pedido preparado. Selecciona el vendedor para enviar.`, 'ok');
        } catch (err) {
            console.error(err);
            mostrarToast(`❌ Error al procesar pedido: ${err.message}`, 'error');
        } finally {
            this.enviandoPedido = false;
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
            this.actualizarBotonQvaPay(); // 👈 NUEVO
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
                this.actualizarBotonQvaPay(); // 👈 NUEVO
            }
            if (btnD) {
                const variantId = btnD.dataset.variant === '' ? null : btnD.dataset.variant;
                const vid = (variantId && variantId !== '') ? parseInt(variantId) : null;
                carrito.disminuir(btnD.dataset.id, vid);
                this.actualizarContador();
                this.renderCarrito();
                this.renderProductos();
                this.actualizarBotonQvaPay(); // 👈 NUEVO
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

        // ========== FILTROS POR CATEGORÍA ==========
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.categoriaActual = btn.dataset.categoria;
                this.filtrarProductos();
            });
        });
        // ===========================================
    }
};