// admin.js - Panel de administración/vendedor para Granma Market
import { escapeHtml } from './utils/escape.js';
import { supabase } from './supabase.js';
import { mostrarToast } from './modules/toast.js';
import { CONFIG } from './config.js';

let productos = [];
let pedidos = [];
let resenas = [];
let editandoId = null;
let borrandoId = null;
let currentUser = null;
let currentUserRole = null;

// Estados del logo
let logoPendiente = null;
let logoActualUrl = null;
let logoEliminar = false;

// ==================== SUBIDA DE IMÁGENES ====================
async function resizeAndOptimizeImage(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

async function subirImagen(file, productoId = null) {
    if (!file) return null;
    try {
        const blobOptimizado = await resizeAndOptimizeImage(file);
        const nombreArchivo = productoId ? `${productoId}_${Date.now()}.webp` : `temp_${Date.now()}.webp`;
        const { data, error } = await supabase.storage
            .from('products')
            .upload(nombreArchivo, blobOptimizado, { contentType: 'image/webp', cacheControl: '3600' });
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(nombreArchivo);
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error('Error subiendo imagen:', err);
        mostrarToast('Error al subir la imagen: ' + err.message, 'error');
        return null;
    }
}

async function subirLogo(file) {
    if (!file) return null;
    try {
        // Los logos son cuadrados 400x400
        const blobOptimizado = await resizeAndOptimizeImage(file, 400, 400);
        const nombreArchivo = `logos/${currentUser.id}_${Date.now()}.webp`;
        const { error } = await supabase.storage
            .from('products')
            .upload(nombreArchivo, blobOptimizado, {
                contentType: 'image/webp',
                cacheControl: '3600',
                upsert: true
            });
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(nombreArchivo);
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error('Error subiendo logo:', err);
        mostrarToast('Error al subir el logo: ' + err.message, 'error');
        return null;
    }
}

function setupImagePreview() {
    const fileInput = document.getElementById('f-imagen-file');
    const previewDiv = document.getElementById('vista-previa');
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
        previewDiv.innerHTML = '';
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;padding:2px;';
                previewDiv.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

// ==================== MI TIENDA ====================
function generarIniciales(nombre) {
    if (!nombre) return '??';
    const palabras = nombre.trim().split(/\s+/).filter(p => p.length > 1);
    if (palabras.length === 0) return nombre.substring(0, 2).toUpperCase();
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

function actualizarPreviewTienda() {
    const nombre = document.getElementById('mi-nombre-tienda')?.value.trim();
    const municipio = document.getElementById('mi-municipio')?.value;
    const previewNombre = document.getElementById('preview-nombre');
    const previewMunicipio = document.getElementById('preview-municipio');
    const previewIniciales = document.getElementById('preview-iniciales');
    const previewAvatar = document.getElementById('preview-avatar');

    if (previewNombre) previewNombre.textContent = nombre || 'Sin nombre';
    if (previewMunicipio) previewMunicipio.textContent = municipio ? `📍 ${municipio}` : 'Sin municipio';

    if (previewIniciales && !previewAvatar?.querySelector('img')) {
        previewIniciales.textContent = generarIniciales(nombre || 'Sin nombre');
    }
}

function renderLogoPreview() {
    const preview = document.getElementById('logo-preview');
    const quitarBtn = document.getElementById('quitar-logo-btn');
    const previewAvatar = document.getElementById('preview-avatar');
    if (!preview) return;

    if (logoPendiente) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Logo">`;
            if (quitarBtn) quitarBtn.style.display = 'inline-flex';
            if (previewAvatar) previewAvatar.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(logoPendiente);
    } else if (logoActualUrl && !logoEliminar) {
        preview.innerHTML = `<img src="${logoActualUrl}" alt="Logo">`;
        if (quitarBtn) quitarBtn.style.display = 'inline-flex';
        if (previewAvatar) previewAvatar.innerHTML = `<img src="${logoActualUrl}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        preview.innerHTML = '<i class="fas fa-store"></i>';
        if (quitarBtn) quitarBtn.style.display = 'none';
        if (previewAvatar) {
            const nombre = document.getElementById('mi-nombre-tienda')?.value.trim() || 'Sin nombre';
            previewAvatar.innerHTML = `<span id="preview-iniciales">${generarIniciales(nombre)}</span>`;
        }
    }
}

async function cargarMiTienda() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('nombre_tienda, nombre_completo, municipio, logo_tienda')
            .eq('id', currentUser.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;

        const nombreInput = document.getElementById('mi-nombre-tienda');
        const municipioSelect = document.getElementById('mi-municipio');
        if (nombreInput) nombreInput.value = data?.nombre_tienda || data?.nombre_completo || '';
        if (municipioSelect) municipioSelect.value = data?.municipio || '';

        logoPendiente = null;
        logoEliminar = false;
        logoActualUrl = data?.logo_tienda || null;

        const logoInput = document.getElementById('mi-logo-input');
        if (logoInput) logoInput.value = '';

        renderLogoPreview();
        actualizarPreviewTienda();
    } catch (err) {
        console.error(err);
        mostrarToast('Error al cargar tu tienda', 'error');
    }
}

async function guardarMiTienda() {
    const btn = document.getElementById('guardar-mi-tienda');
    const nombreTienda = document.getElementById('mi-nombre-tienda')?.value.trim();
    const municipio = document.getElementById('mi-municipio')?.value;

    if (!nombreTienda) { mostrarToast('Escribe un nombre para tu tienda', 'error'); return; }
    if (!municipio) { mostrarToast('Selecciona tu municipio', 'error'); return; }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        let logoUrl = logoActualUrl;

        if (logoPendiente) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo logo...';
            const urlSubida = await subirLogo(logoPendiente);
            if (urlSubida) logoUrl = urlSubida;
            else throw new Error('No se pudo subir el logo');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        } else if (logoEliminar) {
            logoUrl = null;
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                nombre_tienda: nombreTienda,
                municipio: municipio,
                logo_tienda: logoUrl
            })
            .eq('id', currentUser.id);
        if (profileError) throw profileError;

        const { error: prodError } = await supabase
            .from('productos')
            .update({ vendedor: nombreTienda, municipio: municipio })
            .eq('seller_id', currentUser.id);
        if (prodError) console.warn('Error actualizando productos:', prodError);

        localStorage.removeItem('productos_cache');
        localStorage.removeItem('productos_cache_time');

        logoPendiente = null;
        logoEliminar = false;
        logoActualUrl = logoUrl;
        const logoInput = document.getElementById('mi-logo-input');
        if (logoInput) logoInput.value = '';

        mostrarToast('✅ Tienda actualizada correctamente', 'ok');
        renderLogoPreview();
        cargarProductos();
    } catch (err) {
        console.error(err);
        mostrarToast('Error al guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ==================== ESTADO VISUAL QVAPAY ====================
function actualizarEstadoVisualConfig(enabled, merchantId) {
    const statusDiv = document.getElementById('qvapay-status');
    const statusText = document.getElementById('qvapay-status-text');
    if (!statusDiv || !statusText) return;
    if (enabled && merchantId) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#ecfdf5';
        statusDiv.style.border = '1px solid #a7f3d0';
        statusText.innerHTML = `<i class="fas fa-check-circle"></i> <strong>QvaPay activado correctamente</strong><br>Merchant ID: <code>${escapeHtml(merchantId)}</code>`;
    } else {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#fff3e0';
        statusDiv.style.border = '1px solid #ffe0b2';
        statusText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>QvaPay no está activado</strong><br>Debes guardar un Merchant ID válido.`;
    }
}

async function cargarConfiguracionPagos() {
    const guardarBtn = document.getElementById('guardar-config-pagos');
    const originalText = guardarBtn?.innerHTML;
    if (guardarBtn) {
        guardarBtn.disabled = true;
        guardarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
    }
    try {
        if (!currentUser) throw new Error('Usuario no autenticado');
        const { data, error } = await supabase
            .from('profiles')
            .select('qvapay_enabled, qvapay_merchant_id')
            .eq('id', currentUser.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;

        const enabledCheckbox = document.getElementById('qvapay-enabled-checkbox');
        const merchantInput = document.getElementById('qvapay-merchant-id');
        const merchantGroup = document.getElementById('qvapay-merchant-group');

        if (enabledCheckbox) {
            enabledCheckbox.checked = data?.qvapay_enabled || false;
            merchantGroup.style.display = data?.qvapay_enabled ? 'block' : 'none';
        }
        if (merchantInput) merchantInput.value = data?.qvapay_merchant_id || '';
        actualizarEstadoVisualConfig(data?.qvapay_enabled, data?.qvapay_merchant_id);
    } catch (err) {
        console.error(err);
        mostrarToast('Error al cargar configuración de pagos', 'error');
    } finally {
        if (guardarBtn) {
            guardarBtn.disabled = false;
            guardarBtn.innerHTML = originalText || 'Guardar configuración';
        }
    }
}

// ==================== INICIO ====================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/'; return; }
    currentUser = user;

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'pending_seller') {
        mostrarToast('Tu cuenta está pendiente de aprobación.', 'warning');
        setTimeout(() => { window.location.href = '/'; }, 2500);
        return;
    }
    if (!profile || (profile.role !== 'admin' && profile.role !== 'seller')) {
        window.location.href = '/';
        return;
    }
    currentUserRole = profile.role;

    if (currentUserRole !== 'admin') {
        document.getElementById('nav-solicitudes')?.style.setProperty('display', 'none');
        document.getElementById('page-solicitudes')?.style.setProperty('display', 'none');
        document.querySelector('.nav-item[data-page="clientes"]')?.style.setProperty('display', 'none');
    }

    document.getElementById('grupo-url-imagen').style.display = 'none';
    document.getElementById('grupo-file-imagen').style.display = 'block';
    setupImagePreview();

    const shell = document.getElementById('shell');
    if (shell) shell.classList.add('visible');
    iniciar();

    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(`page-${item.dataset.page}`).classList.add('active');

            if (item.dataset.page === 'resenas') cargarResenas();
            if (item.dataset.page === 'pedidos') cargarPedidos();
            if (item.dataset.page === 'solicitudes') cargarSolicitudesYRender();
            if (item.dataset.page === 'configuracion') cargarConfiguracionPagos();
            if (item.dataset.page === 'mitienda') cargarMiTienda();
            if (item.dataset.page === 'clientes') cargarClientes().then(renderClientes);
        });
    });

    document.getElementById('btn-nuevo')?.addEventListener('click', () => abrirNuevo());
    document.getElementById('modal-cerrar')?.addEventListener('click', () => cerrarModal());
    document.getElementById('btn-cancelar')?.addEventListener('click', () => cerrarModal());
    document.getElementById('btn-guardar')?.addEventListener('click', () => guardarProducto());
    document.getElementById('btn-add-variante')?.addEventListener('click', () => agregarVariante());
    document.getElementById('borrar-cerrar')?.addEventListener('click', () => cerrarBorrar());
    document.getElementById('borrar-cancelar')?.addEventListener('click', () => cerrarBorrar());
    document.getElementById('borrar-confirmar')?.addEventListener('click', () => eliminarProducto());

    // ========== MI TIENDA LISTENERS ==========
    document.getElementById('mi-nombre-tienda')?.addEventListener('input', () => {
        actualizarPreviewTienda();
        if (!logoPendiente && (!logoActualUrl || logoEliminar)) {
            renderLogoPreview();
        }
    });
    document.getElementById('mi-municipio')?.addEventListener('change', actualizarPreviewTienda);
    document.getElementById('guardar-mi-tienda')?.addEventListener('click', guardarMiTienda);

    document.getElementById('mi-logo-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            mostrarToast('El logo supera los 2MB', 'error');
            e.target.value = '';
            return;
        }
        logoPendiente = file;
        logoEliminar = false;
        renderLogoPreview();
    });

    document.getElementById('quitar-logo-btn')?.addEventListener('click', () => {
        logoPendiente = null;
        logoEliminar = true;
        const logoInput = document.getElementById('mi-logo-input');
        if (logoInput) logoInput.value = '';
        renderLogoPreview();
    });

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });

    const qvapayEnabledCheckbox = document.getElementById('qvapay-enabled-checkbox');
    const qvapayMerchantGroup = document.getElementById('qvapay-merchant-group');
    if (qvapayEnabledCheckbox) {
        qvapayEnabledCheckbox.addEventListener('change', (e) => {
            qvapayMerchantGroup.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    const guardarConfigBtn = document.getElementById('guardar-config-pagos');
    if (guardarConfigBtn) {
        guardarConfigBtn.addEventListener('click', async () => {
            const enabled = qvapayEnabledCheckbox?.checked || false;
            const merchantId = document.getElementById('qvapay-merchant-id')?.value.trim() || null;
            if (enabled && !merchantId) { mostrarToast('Debes ingresar tu Merchant ID (UUID) de QvaPay', 'error'); return; }

            const originalText = guardarConfigBtn.innerHTML;
            guardarConfigBtn.disabled = true;
            guardarConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            try {
                const { error } = await supabase.from('profiles')
                    .update({ qvapay_enabled: enabled, qvapay_merchant_id: merchantId })
                    .eq('id', currentUser.id);
                if (error) throw error;
                mostrarToast('✅ Configuración guardada correctamente', 'ok');
                actualizarEstadoVisualConfig(enabled, merchantId);
                await cargarConfiguracionPagos();
            } catch (err) {
                mostrarToast('❌ Error al guardar: ' + err.message, 'error');
            } finally {
                guardarConfigBtn.disabled = false;
                guardarConfigBtn.innerHTML = originalText;
            }
        });
    }
});

async function iniciar() {
    await cargarProductos();
    const buscador = document.getElementById('buscador');
    if (buscador) buscador.addEventListener('input', e => renderTabla(e.target.value.trim().toLowerCase()));
}

async function cargarProductos() {
    try {
        if (!currentUser) throw new Error('No hay usuario autenticado');
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
        const isAdmin = profile?.role === 'admin';
        let query = supabase.from('productos').select('*');
        if (!isAdmin) query = query.eq('seller_id', currentUser.id);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        productos = data;
        renderStats();
        renderTabla();
    } catch (err) {
        console.error(err);
        mostrarToast('Error al cargar productos', 'error');
    }
}

function renderStats() {
    const total = productos.length;
    const sinStk = productos.filter(p => p.stock <= 0).length;
    const bajo = productos.filter(p => p.stock > 0 && p.stock <= 3).length;
    const conVar = productos.filter(p => p.variantes?.length > 0).length;
    const ofertas = productos.filter(p => p.enoferta && p.preciooferta).length;
    const statsDiv = document.getElementById('stats-productos');
    if (statsDiv) statsDiv.innerHTML = `
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-val">${total}</div></div>
        <div class="stat-card"><div class="stat-label">Sin stock</div><div class="stat-val" style="color:var(--danger)">${sinStk}</div></div>
        <div class="stat-card"><div class="stat-label">Stock bajo</div><div class="stat-val" style="color:var(--warning)">${bajo}</div></div>
        <div class="stat-card"><div class="stat-label">Con variantes</div><div class="stat-val">${conVar}</div></div>
        <div class="stat-card"><div class="stat-label">En oferta</div><div class="stat-val" style="color:var(--danger)">${ofertas}</div></div>
    `;
}

function optimizarImagenAdmin(url, ancho = 36, alto = 36) {
    if (!url) return '';
    const primeraUrl = url.split(',')[0].trim();
    if (!primeraUrl) return '';
    if (primeraUrl.includes('unsplash.com')) return `${primeraUrl.split('?')[0]}?w=${ancho}&h=${alto}&fit=crop&auto=format&q=80`;
    if (primeraUrl.includes('cloudinary.com')) return primeraUrl.replace('/upload/', `/upload/w_${ancho},h_${alto},c_fill,q_80/`);
    return primeraUrl;
}

function renderTabla(filtro = '') {
    const lista = filtro ? productos.filter(p => p.nombre?.toLowerCase().includes(filtro) || p.vendedor?.toLowerCase().includes(filtro)) : productos;
    const tablaDiv = document.getElementById('tabla-productos');
    if (!tablaDiv) return;
    if (lista.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-box-open"></i><p>${filtro ? 'Sin resultados' : 'No hay productos aún'}</p></div>`;
        return;
    }
    tablaDiv.innerHTML = `<table class="admin-table">
        <thead><tr><th>Producto</th><th>Municipio</th><th>Precio</th><th>Stock</th><th>Oferta</th><th>Variantes</th><th>Acciones</th></tr></thead>
        <tbody>
            ${lista.map(p => `
            <tr>
                <td>
                    <img src="${escapeHtml(optimizarImagenAdmin(p.imagen, 36, 36))}" class="prod-thumb" onerror="this.src='https://placehold.co/36x36?text=?'">
                    <span>
                    <div class="prod-name">${escapeHtml(p.nombre)}</div>
                    <div class="prod-vendedor">${escapeHtml(p.vendedor)}</div>
                    </span>
                </td>
                <td>${p.municipio ? `<span class="badge" style="background:#d1fae5; color:#064e3b;"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.municipio)}</span>` : '—'}</td>
                <td>${Number(p.precio).toLocaleString('es')} ${p.moneda === 'USD' ? 'USD' : 'CUP'}</td>
                <td>${p.stock <= 0 ? '<span class="badge badge-out">Agotado</span>' : p.stock <= 3 ? `<span class="badge badge-low">${p.stock} uds</span>` : `<span class="badge badge-ok">${p.stock} uds</span>`}</td>
                <td>${p.enoferta && p.preciooferta ? `<span class="badge" style="background:#ffebee;color:#c62828">$${Number(p.preciooferta).toLocaleString('es')}</span>` : '—'}</td>
                <td>${p.variantes?.length > 0 ? `<span class="badge badge-variant">${p.variantes.length} var.</span>` : '—'}</td>
                <td><div class="actions"><button class="act-btn" data-edit="${p.id}"><i class="fas fa-pen"></i> Editar</button><button class="act-btn del" data-del="${p.id}" data-nombre="${escapeHtml(p.nombre)}"><i class="fas fa-trash"></i></button></div></td>
            </tr>`).join('')}
        </tbody>
    </table>`;
    document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => abrirEditar(btn.dataset.edit)));
    document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => abrirBorrar(btn.dataset.del, btn.dataset.nombre)));
}

async function cargarPedidos() {
    try {
        if (!currentUser) return;
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
        const isAdmin = profile?.role === 'admin';
        let query = supabase.from('pedidos').select('*');
        if (!isAdmin) query = query.eq('vendedor_id', currentUser.id);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        pedidos = data;
        renderPedidos();
    } catch (err) { mostrarToast('Error al cargar pedidos', 'error'); }
}

function renderPedidos() {
    const tablaDiv = document.getElementById('tabla-pedidos');
    if (!tablaDiv) return;
    if (pedidos.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-truck"></i><p>No hay pedidos aún</p></div>`;
        return;
    }
    tablaDiv.innerHTML = `<table class="admin-table">
        <thead><tr><th>Cliente</th><th>Entrega</th><th>Productos</th><th>Subtotal</th><th>Envío</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
            ${pedidos.map(p => {
                const subtotal = Number(p.total).toLocaleString('es');
                const envioTxt = p.costo_envio != null ? `$${Number(p.costo_envio).toLocaleString('es')}` : '<span class="badge badge-low">Por confirmar</span>';
                const totalConEnvio = p.costo_envio != null ? `$${(Number(p.total) + Number(p.costo_envio)).toLocaleString('es')}` : null;
                return `
                <tr>
                    <td><strong>${escapeHtml(p.cliente_nombre)}</strong><br><small style="color:#888;">📞 ${escapeHtml(p.cliente_telefono || 'N/D')}</small></td>
                    <td><small>📍 <strong>${escapeHtml(p.municipio_entrega || 'No especificado')}</strong><br>${escapeHtml(p.direccion_entrega || '')}${p.referencia_entrega ? `<br><em>Ref: ${escapeHtml(p.referencia_entrega)}</em>` : ''}</small></td>
                    <td><ul style="margin:0; padding-left:1rem; font-size:0.8rem;">${p.productos.map(prod => `<li>${escapeHtml(prod.nombre)} x${prod.cantidad}</li>`).join('')}</ul></td>
                    <td>$${subtotal}</td>
                    <td>${envioTxt}${totalConEnvio ? `<br><small style="color:#065f46;"><strong>Total: ${totalConEnvio}</strong></small>` : ''}</td>
                    <td><span class="badge ${p.status === 'pendiente' ? 'badge-low' : 'badge-ok'}">${p.status === 'pendiente' ? 'Pendiente' : (p.status === 'paid' ? 'Pagado' : 'Confirmado')}</span></td>
                    <td>
                        ${p.costo_envio == null && p.status === 'pendiente' ? `<button class="asignar-envio bg-primary text-white border-0 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer" data-id="${escapeHtml(p.id)}"><i class="fas fa-dollar-sign"></i> Asignar envío</button>` : ''}
                        ${p.status === 'pendiente' && p.costo_envio != null ? `<button class="confirmar-pedido bg-whatsapp text-white border-0 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer" data-id="${escapeHtml(p.id)}"><i class="fas fa-check"></i> Confirmar</button>` : ''}
                        ${p.status === 'paid' ? `<button class="confirmar-pedido bg-whatsapp text-white border-0 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer" data-id="${escapeHtml(p.id)}"><i class="fas fa-check"></i> Confirmar</button>` : ''}
                    </td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>`;
    document.querySelectorAll('.confirmar-pedido').forEach(btn => btn.addEventListener('click', () => confirmarPedido(btn.dataset.id)));
    document.querySelectorAll('.asignar-envio').forEach(btn => btn.addEventListener('click', () => abrirModalEnvio(btn.dataset.id)));
}

function abrirModalEnvio(pedidoId) {
    const p = pedidos.find(x => x.id === pedidoId);
    if (!p) return;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4';
    overlay.id = 'modal-envio-admin';
    overlay.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div class="bg-primary text-white px-5 py-4 flex items-center justify-between">
                <h2 class="text-lg font-bold flex items-center gap-2 m-0" style="font-family: 'Outfit', sans-serif;">
                    <i class="fas fa-truck"></i> Asignar costo de envío
                </h2>
                <button id="cerrar-envio-admin" class="bg-transparent border-0 text-white text-2xl cursor-pointer opacity-80">&times;</button>
            </div>
            <div class="p-5 flex flex-col gap-4">
                <div class="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed border border-gray-100">
                    <p class="m-0 mb-1"><strong>👤 Cliente:</strong> ${escapeHtml(p.cliente_nombre)}</p>
                    <p class="m-0 mb-1"><strong>📞 Teléfono:</strong> ${escapeHtml(p.cliente_telefono || 'N/D')}</p>
                    <p class="m-0 mb-1"><strong>📍 Municipio:</strong> ${escapeHtml(p.municipio_entrega || 'N/D')}</p>
                    <p class="m-0 mb-1"><strong>🏠 Dirección:</strong> ${escapeHtml(p.direccion_entrega || 'N/D')}</p>
                    <p class="m-0 mt-3 pt-3 border-t border-dashed border-gray-300"><strong>💰 Subtotal:</strong> $${Number(p.total).toLocaleString('es')}</p>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wide">Costo de envío (CUP) *</label>
                    <input type="number" id="costo-envio-input" placeholder="Ej: 500" min="0" step="50"
                        class="w-full px-3.5 py-3 border-[1.5px] border-gray-200 rounded-lg text-[0.95rem] bg-gray-50 outline-none">
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wide">Nota para el cliente (opcional)</label>
                    <textarea id="nota-envio-input" rows="2" placeholder="Ej: Entrega en 2-3 días hábiles"
                        class="w-full px-3.5 py-3 border-[1.5px] border-gray-200 rounded-lg text-[0.95rem] bg-gray-50 outline-none"></textarea>
                </div>
            </div>
            <div class="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                <button id="cancelar-envio-admin" class="bg-white text-gray-700 border-[1.5px] border-gray-200 rounded-lg px-5 py-2.5 text-sm font-semibold">Cancelar</button>
                <button id="confirmar-envio-admin" class="bg-primary text-white border-0 rounded-lg px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2"><i class="fas fa-check"></i> Confirmar costo</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('cerrar-envio-admin').onclick = () => overlay.remove();
    document.getElementById('cancelar-envio-admin').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('confirmar-envio-admin').onclick = async () => {
        const costo = parseFloat(document.getElementById('costo-envio-input').value);
        const nota = document.getElementById('nota-envio-input').value.trim();
        if (isNaN(costo) || costo < 0) { mostrarToast('Ingresa un costo válido', 'error'); return; }

        const btn = document.getElementById('confirmar-envio-admin');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            const { error } = await supabase.from('pedidos').update({ costo_envio: costo, envio_confirmado: true }).eq('id', pedidoId);
            if (error) throw error;

            const totalFinal = Number(p.total) + costo;
            const moneda = p.productos?.[0]?.moneda || 'CUP';
            const textoMoneda = moneda === 'USD' ? 'USD' : 'CUP';

            let textoCliente = `🚚 *Granma Market — Costo de envío confirmado*\n\n`;
            textoCliente += `Hola ${p.cliente_nombre}, tu pedido ya tiene costo de envío asignado:\n\n`;
            textoCliente += `📦 Subtotal productos: $${Number(p.total).toLocaleString('es')} ${textoMoneda}\n`;
            textoCliente += `🚚 Costo de envío a *${p.municipio_entrega}*: $${costo.toLocaleString('es')} ${textoMoneda}\n`;
            textoCliente += `\n💰 *TOTAL A PAGAR: $${totalFinal.toLocaleString('es')} ${textoMoneda}*\n`;
            if (nota) textoCliente += `\n📝 ${nota}\n`;
            textoCliente += `\nCuando estés de acuerdo, responde este mensaje para coordinar el pago y la entrega. ¡Gracias!`;

            const telCliente = (p.cliente_telefono || '').replace(/\s+/g, '').replace(/^53/, '');
            const linkWa = telCliente ? `https://wa.me/53${telCliente}?text=${encodeURIComponent(textoCliente)}` : null;

            overlay.remove();
            cargarPedidos();

            if (linkWa) {
                setTimeout(() => {
                    if (confirm('✅ Costo de envío guardado.\n\n¿Notificar al cliente por WhatsApp ahora?')) {
                        window.open(linkWa, '_blank');
                    }
                }, 300);
            } else {
                mostrarToast('✅ Costo de envío asignado', 'ok');
            }
        } catch (err) {
            mostrarToast('Error al asignar costo: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Confirmar costo';
        }
    };
}

async function confirmarPedido(pedidoId) {
    try {
        const { data, error } = await supabase.rpc('confirmar_pedido', { pedido_id: pedidoId });
        if (error) throw error;
        if (data && data.success === true) {
            mostrarToast('Pedido confirmado y stock actualizado', 'ok');
            cargarPedidos();
            cargarProductos();
            localStorage.removeItem('productos_cache');
            localStorage.removeItem('productos_cache_time');
        } else {
            throw new Error(data?.error || 'Error al confirmar el pedido');
        }
    } catch (err) {
        mostrarToast(`Error: ${err.message}`, 'error');
    }
}

async function cargarResenas() {
    try {
        if (!currentUser) return;
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
        if (profile?.role !== 'admin') {
            document.getElementById('tabla-resenas').innerHTML = `<div class="table-empty"><i class="fas fa-lock"></i><p>Solo administradores pueden ver todas las reseñas.</p></div>`;
            return;
        }
        const { data, error } = await supabase.from('reseñas').select('*').order('fecha', { ascending: false });
        if (error) throw error;
        resenas = data;
        renderResenas();
    } catch (err) {
        document.getElementById('tabla-resenas').innerHTML = `<div class="table-empty"><i class="fas fa-exclamation-triangle"></i><p>Error al cargar reseñas</p></div>`;
    }
}

function renderResenas() {
    const tablaDiv = document.getElementById('tabla-resenas');
    if (!tablaDiv) return;
    if (resenas.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-star"></i><p>No hay reseñas aún.</p></div>`;
        return;
    }
    tablaDiv.innerHTML = `<table class="admin-table">
        <thead><tr><th>Producto ID</th><th>Nombre</th><th>Estrellas</th><th>Comentario</th><th>Fecha</th></tr></thead>
        <tbody>
            ${resenas.map(r => `
            <tr>
                <td>${escapeHtml(r.productoid)}</td>
                <td>${escapeHtml(r.nombre)}</td>
                <td>${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}</td>
                <td>${escapeHtml(r.texto)}</td>
                <td>${new Date(r.fecha).toLocaleDateString()}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

async function cargarSolicitudes() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nombre_completo, telefono, created_at, role, qvapay_enabled, qvapay_merchant_id')
        .eq('role', 'pending_seller')
        .order('created_at', { ascending: false });
    if (error) { mostrarToast('Error al cargar solicitudes', 'error'); return []; }
    return data;
}

function renderSolicitudes(solicitudes) {
    const tablaDiv = document.getElementById('tabla-solicitudes');
    if (!tablaDiv) return;
    if (solicitudes.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-user-check"></i><p>No hay solicitudes pendientes.</p></div>`;
        return;
    }
    tablaDiv.innerHTML = `<table class="admin-table">
        <thead><tr><th>Email</th><th>Nombre</th><th>Teléfono</th><th>Fecha</th><th>QvaPay</th><th>Acciones</th></tr></thead>
        <tbody>
            ${solicitudes.map(s => `
            <tr>
                <td>${escapeHtml(s.email)}</td>
                <td>${escapeHtml(s.nombre_completo || '—')}</td>
                <td>${escapeHtml(s.telefono || '—')}</td>
                <td>${new Date(s.created_at).toLocaleDateString()}</td>
                <td>${s.qvapay_enabled && s.qvapay_merchant_id ? `<span class="badge badge-ok"><i class="fas fa-check-circle"></i> Activado</span>` : `<span class="badge badge-out"><i class="fas fa-times-circle"></i> Inactivo</span>`}</td>
                <td>
                    <button class="act-btn aprobar-solicitud" data-id="${s.id}" data-email="${escapeHtml(s.email)}">Aprobar</button>
                    <button class="act-btn del rechazar-solicitud" data-id="${s.id}" data-email="${escapeHtml(s.email)}">Rechazar</button>
                </td>
            </tr>`).join('')}
        </tbody>
    </table>`;
    document.querySelectorAll('.aprobar-solicitud').forEach(btn => btn.addEventListener('click', () => aprobarVendedor(btn.dataset.id, btn.dataset.email)));
    document.querySelectorAll('.rechazar-solicitud').forEach(btn => btn.addEventListener('click', () => rechazarVendedor(btn.dataset.id, btn.dataset.email)));
}

async function aprobarVendedor(userId, email) {
    const { error } = await supabase.from('profiles').update({ role: 'seller' }).eq('id', userId);
    if (error) mostrarToast(`Error al aprobar a ${escapeHtml(email)}`, 'error');
    else {
        mostrarToast(`✅ Vendedor ${escapeHtml(email)} aprobado`, 'ok');
        renderSolicitudes(await cargarSolicitudes());
    }
}

async function rechazarVendedor(userId, email) {
    const { error } = await supabase.from('profiles').update({ role: 'customer' }).eq('id', userId);
    if (error) mostrarToast(`Error al rechazar a ${escapeHtml(email)}`, 'error');
    else {
        mostrarToast(`❌ Vendedor ${escapeHtml(email)} rechazado`, 'info');
        renderSolicitudes(await cargarSolicitudes());
    }
}

async function cargarSolicitudesYRender() {
    if (currentUserRole !== 'admin') { mostrarToast('Acceso denegado. Solo administradores.', 'error'); return; }
    renderSolicitudes(await cargarSolicitudes());
}

async function cargarClientes() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nombre_completo, telefono, created_at, role')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
    if (error) { mostrarToast('Error al cargar clientes', 'error'); return []; }
    return data;
}

function renderClientes(clientes) {
    const tablaDiv = document.getElementById('tabla-clientes');
    if (!tablaDiv) return;
    if (clientes.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-user-slash"></i><p>No hay clientes registrados.</p></div>`;
        return;
    }
    tablaDiv.innerHTML = `<table class="admin-table">
        <thead><tr><th>Email</th><th>Nombre</th><th>Teléfono</th><th>Fecha registro</th><th>Acciones</th></tr></thead>
        <tbody>
            ${clientes.map(c => `
            <tr>
                <td>${escapeHtml(c.email)}</td>
                <td>${escapeHtml(c.nombre_completo || '—')}</td>
                <td>${escapeHtml(c.telefono || '—')}</td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td><button class="act-btn convertir-seller" data-id="${c.id}" data-email="${escapeHtml(c.email)}"><i class="fas fa-user-check"></i> Aprobar como vendedor</button></td>
            </tr>`).join('')}
        </tbody>
    </table>`;
    document.querySelectorAll('.convertir-seller').forEach(btn => {
        btn.addEventListener('click', () => convertirEnVendedor(btn.dataset.id, btn.dataset.email));
    });
}

async function convertirEnVendedor(userId, email) {
    const { error } = await supabase.from('profiles').update({ role: 'seller' }).eq('id', userId);
    if (error) mostrarToast(`Error al aprobar a ${escapeHtml(email)}`, 'error');
    else {
        mostrarToast(`✅ ${escapeHtml(email)} ahora es vendedor`, 'ok');
        renderClientes(await cargarClientes());
        renderSolicitudes(await cargarSolicitudes());
    }
}

// ==================== CRUD PRODUCTOS ====================
function abrirNuevo() {
    editandoId = null;
    document.getElementById('modal-titulo').innerText = 'Nuevo producto';
    limpiarFormulario();
    document.getElementById('modal-producto').removeAttribute('hidden');
}

function abrirEditar(id) {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    editandoId = id;
    document.getElementById('modal-titulo').innerText = 'Editar producto';
    document.getElementById('f-nombre').value = prod.nombre;
    document.getElementById('f-precio').value = prod.precio;
    document.getElementById('f-stock').value = prod.stock;
    document.getElementById('f-vendedor').value = prod.vendedor;
    document.getElementById('f-telefono-vendedor').value = prod.telefonovendedor || '';
    document.getElementById('f-imagen').value = prod.imagen;
    document.getElementById('f-precio-oferta').value = prod.preciooferta ?? '';
    document.getElementById('f-en-oferta').checked = prod.enoferta || false;

    const municipioSelect = document.getElementById('f-municipio');
    if (municipioSelect) municipioSelect.value = prod.municipio || '';
    const categoriaSelect = document.getElementById('f-categoria');
    if (categoriaSelect) categoriaSelect.value = prod.categoria || 'Otros';
    const monedaSelect = document.getElementById('f-moneda');
    if (monedaSelect) monedaSelect.value = prod.moneda || 'CUP';

    const previewDiv = document.getElementById('vista-previa');
    if (previewDiv) {
        previewDiv.innerHTML = '';
        const imagenes = [prod.imagen, ...(prod.galeria || [])].filter(url => url && url !== '');
        imagenes.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;padding:2px;';
            previewDiv.appendChild(img);
        });
    }
    const variantesDiv = document.getElementById('variantes-list');
    variantesDiv.innerHTML = '';
    if (prod.variantes && prod.variantes.length) prod.variantes.forEach((v, i) => agregarVariante(v, i));
    document.getElementById('modal-producto').removeAttribute('hidden');
}

function limpiarFormulario() {
    document.getElementById('f-nombre').value = '';
    document.getElementById('f-precio').value = '';
    document.getElementById('f-stock').value = '';
    document.getElementById('f-vendedor').value = '';
    document.getElementById('f-telefono-vendedor').value = '';
    document.getElementById('f-imagen').value = '';
    document.getElementById('f-precio-oferta').value = '';
    document.getElementById('f-en-oferta').checked = false;
    const municipioSelect = document.getElementById('f-municipio');
    if (municipioSelect) municipioSelect.value = '';
    const categoriaSelect = document.getElementById('f-categoria');
    if (categoriaSelect) categoriaSelect.value = 'Otros';
    document.getElementById('variantes-list').innerHTML = '';
    const previewDiv = document.getElementById('vista-previa');
    if (previewDiv) previewDiv.innerHTML = '';
    const fileInput = document.getElementById('f-imagen-file');
    if (fileInput) fileInput.value = '';
}

// ==================== VARIANTES ====================
function agregarVariante(v = null, index = null) {
    const div = document.createElement('div');
    div.className = 'variante-item';

    const imagenActual = v?.imagen || '';
    const tieneImagen = !!imagenActual;

    div.innerHTML = `
        <button class="btn-rm-variante" type="button"><i class="fas fa-times"></i></button>
        <div class="variante-fila">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" class="var-nombre" placeholder="Ej: Rojo, XL" value="${escapeHtml(v?.nombre || '')}">
            </div>
            <div class="form-group">
                <label>Precio (CUP)</label>
                <input type="number" class="var-precio" placeholder="Opcional" value="${v?.precio ?? ''}">
            </div>
        </div>
        <div class="variante-fila">
            <div class="form-group">
                <label>Stock</label>
                <input type="number" class="var-stock" placeholder="Cantidad" value="${v?.stock ?? ''}">
            </div>
            <div class="form-group">
                <label>Imagen de la variante</label>
                <div class="variante-imagen-fila">
                    <div class="variante-preview ${tieneImagen ? 'tiene-imagen' : ''}" data-url="${escapeHtml(imagenActual)}">
                        ${tieneImagen
                            ? `<img src="${escapeHtml(imagenActual)}" alt="Variante" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-image\\'></i>';"><button type="button" class="variante-preview-quitar" title="Quitar imagen"><i class="fas fa-times"></i></button>`
                            : `<i class="fas fa-image"></i>`
                        }
                    </div>
                    <div class="variante-upload">
                        <label class="variante-upload-label">
                            <i class="fas fa-cloud-upload-alt"></i> Subir imagen
                            <input type="file" class="var-imagen-input" accept="image/jpeg,image/png,image/webp">
                        </label>
                        <span class="variante-upload-hint">JPG, PNG o WebP · máx. 5MB</span>
                    </div>
                </div>
            </div>
        </div>`;

    div.querySelector('.btn-rm-variante').addEventListener('click', () => div.remove());

    const previewEl = div.querySelector('.variante-preview');
    const fileInput = div.querySelector('.var-imagen-input');
    const quitarBtn = div.querySelector('.variante-preview-quitar');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            mostrarToast('La imagen supera los 5MB', 'error');
            fileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            previewEl.innerHTML = `
                <img src="${event.target.result}" alt="Nueva imagen">
                <button type="button" class="variante-preview-quitar" title="Quitar imagen"><i class="fas fa-times"></i></button>
            `;
            previewEl.classList.add('tiene-imagen');
            previewEl.dataset.url = '';
            previewEl.dataset.pendiente = 'true';

            previewEl.querySelector('.variante-preview-quitar').addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                quitarImagenVariante(previewEl, fileInput);
            });
        };
        reader.readAsDataURL(file);
    });

    if (quitarBtn) {
        quitarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            quitarImagenVariante(previewEl, fileInput);
        });
    }

    document.getElementById('variantes-list').appendChild(div);
}

function quitarImagenVariante(previewEl, fileInput) {
    previewEl.innerHTML = '<i class="fas fa-image"></i>';
    previewEl.classList.remove('tiene-imagen');
    previewEl.dataset.url = '';
    previewEl.dataset.pendiente = 'false';
    if (fileInput) fileInput.value = '';
}

function validarTelefonoCubano(tel) {
    return /^5[0-9]{7}$/.test(tel.replace(/\s+/g, ''));
}

async function guardarProducto() {
    const btnGuardar = document.getElementById('btn-guardar');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const nombre = document.getElementById('f-nombre').value.trim();
        const precio = parseFloat(document.getElementById('f-precio').value);
        const stock = parseInt(document.getElementById('f-stock').value);
        const vendedor = document.getElementById('f-vendedor').value.trim();
        let telefonovendedor = document.getElementById('f-telefono-vendedor').value.trim();
        const enOferta = document.getElementById('f-en-oferta').checked;
        const precioOferta = enOferta ? parseFloat(document.getElementById('f-precio-oferta').value) : null;
        const categoria = document.getElementById('f-categoria').value;
        const moneda = document.getElementById('f-moneda')?.value || 'CUP';
        const municipio = document.getElementById('f-municipio')?.value.trim() || null;

        if (!nombre || isNaN(precio) || isNaN(stock) || !vendedor) { mostrarToast('Completa los campos obligatorios', 'error'); return; }
        if (!municipio) { mostrarToast('Selecciona el municipio del producto', 'error'); return; }
        if (telefonovendedor && !validarTelefonoCubano(telefonovendedor)) { mostrarToast('El teléfono debe tener formato cubano: 5XXXXXXX', 'error'); return; }
        if (!telefonovendedor) telefonovendedor = null;

        let imagenPrincipal = '';
        let galeriaUrls = [];
        const fileInput = document.getElementById('f-imagen-file');
        const urlInput = document.getElementById('f-imagen').value.trim();

        if (fileInput.files.length > 0) {
            const files = Array.from(fileInput.files);
            if (files.length > 6) { mostrarToast('Máximo 6 imágenes por producto', 'error'); return; }
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) { mostrarToast(`La imagen "${file.name}" supera los 10MB`, 'error'); return; }
                const uploadedUrl = await subirImagen(file, editandoId);
                if (!uploadedUrl) throw new Error('No se pudo subir una de las imágenes');
                if (!imagenPrincipal) imagenPrincipal = uploadedUrl;
                else galeriaUrls.push(uploadedUrl);
            }
        } else if (urlInput) {
            imagenPrincipal = urlInput;
        } else if (editandoId) {
            const prodActual = productos.find(p => p.id === editandoId);
            imagenPrincipal = prodActual?.imagen || '';
            galeriaUrls = prodActual?.galeria || [];
        } else {
            mostrarToast('Debes seleccionar al menos una imagen', 'error');
            return;
        }

        document.getElementById('f-imagen').value = imagenPrincipal;

        const variantes = [];
        const varianteItems = document.querySelectorAll('.variante-item');

        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando variantes...';

        for (const item of varianteItems) {
            const nombreVar = item.querySelector('.var-nombre')?.value.trim();
            if (!nombreVar) continue;

            const precioVar = parseFloat(item.querySelector('.var-precio')?.value);
            const stockVar = parseInt(item.querySelector('.var-stock')?.value);
            const previewEl = item.querySelector('.variante-preview');
            const fileInputVar = item.querySelector('.var-imagen-input');

            let imagenVarUrl = null;

            if (fileInputVar && fileInputVar.files && fileInputVar.files[0]) {
                const uploadedUrl = await subirImagen(fileInputVar.files[0], editandoId);
                if (uploadedUrl) imagenVarUrl = uploadedUrl;
            } else if (previewEl?.dataset.url) {
                imagenVarUrl = previewEl.dataset.url;
            }

            variantes.push({
                nombre: nombreVar,
                precio: isNaN(precioVar) ? null : precioVar,
                stock: isNaN(stockVar) ? 0 : stockVar,
                imagen: imagenVarUrl
            });
        }

        const productoData = {
            nombre, precio, stock,
            imagen: imagenPrincipal,
            vendedor, telefonovendedor,
            enoferta: enOferta, preciooferta: precioOferta,
            categoria,
            variantes: variantes.length ? variantes : [],
            seller_id: currentUser.id,
            moneda,
            galeria: galeriaUrls,
            municipio
        };

        let error;
        if (editandoId) {
            ({ error } = await supabase.from('productos').update(productoData).eq('id', editandoId));
        } else {
            ({ error } = await supabase.from('productos').insert([productoData]));
        }
        if (error) throw error;

        localStorage.removeItem('productos_cache');
        localStorage.removeItem('productos_cache_time');
        mostrarToast('Producto guardado', 'ok');
        cerrarModal();
        cargarProductos();
    } catch (err) {
        console.error(err);
        mostrarToast(err.message || 'Error inesperado', 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
}

function cerrarModal() {
    document.getElementById('modal-producto').setAttribute('hidden', '');
}

function abrirBorrar(id, nombre) {
    borrandoId = id;
    document.getElementById('borrar-nombre').innerText = nombre;
    document.getElementById('modal-borrar').removeAttribute('hidden');
}

function cerrarBorrar() {
    document.getElementById('modal-borrar')?.setAttribute('hidden', '');
    borrandoId = null;
}

async function eliminarProducto() {
    if (!borrandoId) return;
    const confirmarBtn = document.getElementById('borrar-confirmar');
    const textoOriginal = confirmarBtn.innerHTML;
    confirmarBtn.disabled = true;
    confirmarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';

    try {
        if (currentUserRole !== 'admin') {
            const { data: pedidos, error } = await supabase
                .from('pedidos').select('id, productos').eq('vendedor_id', currentUser.id);
            if (error) throw error;
            const tienePedidos = pedidos.some(pedido => {
                if (!pedido.productos || !Array.isArray(pedido.productos)) return false;
                return pedido.productos.some(item => item.id === borrandoId);
            });
            if (tienePedidos) {
                mostrarToast('❌ No se puede eliminar: el producto tiene pedidos asociados.', 'error');
                return;
            }
        }

        const { error } = await supabase.from('productos').delete().eq('id', borrandoId);
        if (error) throw error;

        mostrarToast('✅ Producto eliminado', 'ok');
        localStorage.removeItem('productos_cache');
        localStorage.removeItem('productos_cache_time');
        cerrarBorrar();
        cargarProductos();
    } catch (err) {
        console.error('Error al eliminar producto:', err);
        mostrarToast(err.message || '❌ Error al eliminar producto', 'error');
    } finally {
        confirmarBtn.disabled = false;
        confirmarBtn.innerHTML = textoOriginal;
        if (!borrandoId) return;
        borrandoId = null;
    }
}