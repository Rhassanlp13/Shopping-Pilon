// admin.js - Panel de administración/vendedor para Shopping Pilón
// Incluye gestión de productos, pedidos, reseñas, vendedores, configuración de pagos QvaPay y clientes

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
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
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
            .upload(nombreArchivo, blobOptimizado, {
                contentType: 'image/webp',
                cacheControl: '3600'
            });
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(nombreArchivo);
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error('Error subiendo imagen:', err);
        mostrarToast('Error al subir la imagen: ' + err.message, 'error');
        return null;
    }
}

function setupImagePreview() {
    const fileInput = document.getElementById('f-imagen-file');
    const previewDiv = document.getElementById('vista-previa');
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewDiv.innerHTML = `<img src="${event.target.result}" style="max-width: 100%; max-height: 150px; border-radius: 8px; border: 1px solid #ddd; padding: 4px;">`;
            };
            reader.readAsDataURL(file);
        } else {
            previewDiv.innerHTML = '';
        }
    });
}

// ==================== ESTADO VISUAL QVAPAY ====================
function actualizarEstadoVisualConfig(enabled, merchantId) {
    const statusDiv = document.getElementById('qvapay-status');
    const statusText = document.getElementById('qvapay-status-text');
    if (!statusDiv || !statusText) return;

    if (enabled && merchantId) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#e8f5e9';
        statusDiv.style.border = '1px solid #c8e6c9';
        statusText.innerHTML = `<i class="fas fa-check-circle"></i> <strong>QvaPay activado correctamente</strong><br>Merchant ID: <code>${escapeHtml(merchantId)}</code>`;
    } else {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#fff3e0';
        statusDiv.style.border = '1px solid #ffe0b2';
        statusText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>QvaPay no está activado</strong><br>Debes guardar un Merchant ID válido para recibir pagos digitales.`;
    }
}

// ==================== CONFIGURACIÓN DE PAGOS QVAPAY ====================
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
        mostrarToast('Configuración cargada', 'ok');
    } catch (err) {
        console.error('Error cargando configuración:', err);
        mostrarToast('Error al cargar configuración de pagos', 'error');
    } finally {
        if (guardarBtn) {
            guardarBtn.disabled = false;
            guardarBtn.innerHTML = originalText || 'Guardar configuración';
        }
    }
}

// ==================== FUNCIONES PRINCIPALES ====================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/';
        return;
    }
    currentUser = user;

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (profile?.role === 'pending_seller') {
        mostrarToast('Tu cuenta está pendiente de aprobación. Espera a que un administrador la active.', 'warning');
        setTimeout(() => { window.location.href = '/'; }, 2500);
        return;
    }

    if (!profile || (profile.role !== 'admin' && profile.role !== 'seller')) {
        window.location.href = '/';
        return;
    }
    currentUserRole = profile.role;

    if (currentUserRole !== 'admin') {
        const navSolicitudes = document.getElementById('nav-solicitudes');
        if (navSolicitudes) navSolicitudes.style.display = 'none';
        const solicitudesPage = document.getElementById('page-solicitudes');
        if (solicitudesPage) solicitudesPage.style.display = 'none';
        // Los clientes solo son visibles para admin
        const navClientes = document.querySelector('.nav-item[data-page="clientes"]');
        if (navClientes) navClientes.style.display = 'none';
    }

    const grupoUrl = document.getElementById('grupo-url-imagen');
    const grupoFile = document.getElementById('grupo-file-imagen');
    if (currentUserRole === 'admin') {
        grupoUrl.style.display = 'block';
        grupoFile.style.display = 'none';
    } else {
        grupoUrl.style.display = 'none';
        grupoFile.style.display = 'block';
        setupImagePreview();
    }

    const shell = document.getElementById('shell');
    if (shell) shell.classList.add('visible');
    iniciar();

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });

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
            if (item.dataset.page === 'clientes') {
                cargarClientes().then(clientes => renderClientes(clientes));
            }
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

    // Configuración QvaPay
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

            if (enabled && !merchantId) {
                mostrarToast('Debes ingresar tu Merchant ID (UUID) de QvaPay', 'error');
                return;
            }

            const originalText = guardarConfigBtn.innerHTML;
            guardarConfigBtn.disabled = true;
            guardarConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ qvapay_enabled: enabled, qvapay_merchant_id: merchantId })
                    .eq('id', currentUser.id);

                if (error) throw error;

                mostrarToast('✅ Configuración guardada correctamente', 'ok');
                actualizarEstadoVisualConfig(enabled, merchantId);
                await cargarConfiguracionPagos(); // refresca campos
            } catch (err) {
                console.error(err);
                mostrarToast('❌ Error al guardar configuración: ' + err.message, 'error');
            } finally {
                guardarConfigBtn.disabled = false;
                guardarConfigBtn.innerHTML = originalText;
            }
        });
    }

    // Botón de ayuda flotante (tutorial)
    document.getElementById('help-button')?.addEventListener('click', () => {
        const tutorialModal = document.getElementById('tutorial-modal');
        if (tutorialModal) tutorialModal.removeAttribute('hidden');
    });
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
    if (url.includes('unsplash.com')) {
        const baseUrl = url.split('?')[0];
        return `${baseUrl}?w=${ancho}&h=${alto}&fit=crop&auto=format&q=80`;
    }
    if (url.includes('cloudinary.com')) {
        return url.replace('/upload/', `/upload/w_${ancho},h_${alto},c_fill,q_80/`);
    }
    return url;
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
        <thead>
            <tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Oferta</th><th>Variantes</th><th>Acciones</th></tr>
        </thead>
        <tbody>
            ${lista.map(p => `
            <tr>
                <td><img src="${escapeHtml(optimizarImagenAdmin(p.imagen, 36, 36))}" class="prod-thumb" onerror="this.src='https://placehold.co/36x36?text=?'"><span><div class="prod-name">${escapeHtml(p.nombre)}</div><div class="prod-vendedor">${escapeHtml(p.vendedor)}</div></span></td>
                <td>$${Number(p.precio).toLocaleString('es')} CUP</td>
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
    } catch (err) {
        mostrarToast('Error al cargar pedidos', 'error');
    }
}

function renderPedidos() {
    const tablaDiv = document.getElementById('tabla-pedidos');
    if (!tablaDiv) return;
    if (pedidos.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-truck"></i><p>No hay pedidos aún</p></div>`;
        return;
    }
    tablaDiv.innerHTML = `<table class="admin-table">
        <thead>
            <tr><th>Cliente</th><th>Teléfono</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Productos</th><th>Acciones</th></tr>
        </thead>
        <tbody>
            ${pedidos.map(p => `
            <tr>
                <td>${escapeHtml(p.cliente_nombre)}</td>
                <td>${escapeHtml(p.cliente_telefono)}</td>
                <td>${new Date(p.created_at).toLocaleString()}</td>
                <td>$${Number(p.total).toLocaleString('es')}</td>
                <td><span class="badge ${p.status === 'pendiente' ? 'badge-low' : (p.status === 'paid' ? 'badge-ok' : 'badge-ok')}">
                    ${p.status === 'pendiente' ? 'Pendiente' : (p.status === 'paid' ? 'Pagado' : 'Confirmado')}
                </span></td>
                <td><ul>${p.productos.map(prod => `<li>${escapeHtml(prod.nombre)} x${prod.cantidad} - $${Number(prod.precio * prod.cantidad).toLocaleString('es')}</li>`).join('')}</ul></td>
                <td>${(p.status === 'pendiente' || p.status === 'paid') ? `<button class="act-btn confirmar-pedido" data-id="${escapeHtml(p.id)}">Confirmar</button>` : '—'}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
    document.querySelectorAll('.confirmar-pedido').forEach(btn => btn.addEventListener('click', () => confirmarPedido(btn.dataset.id)));
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
        const isAdmin = profile?.role === 'admin';
        if (!isAdmin) {
            document.getElementById('tabla-resenas').innerHTML = `<div class="table-empty"><i class="fas fa-lock"></i><p>Solo administradores pueden ver todas las reseñas.</p></div>`;
            return;
        }
        const { data, error } = await supabase.from('reseñas').select('*').order('fecha', { ascending: false });
        if (error) throw error;
        resenas = data;
        renderResenas();
    } catch (err) {
        console.error(err);
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
        <thead>
            <tr><th>Producto ID</th><th>Nombre</th><th>Estrellas</th><th>Comentario</th><th>Fecha</th></tr>
        </thead>
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

// ==================== SOLICITUDES DE VENDEDORES ====================
async function cargarSolicitudes() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nombre_completo, telefono, created_at, role, qvapay_enabled, qvapay_merchant_id')
        .eq('role', 'pending_seller')
        .order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        mostrarToast('Error al cargar solicitudes', 'error');
        return [];
    }
    return data;
}

async function cargarVendedoresActivos() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nombre_completo, telefono, created_at, role, qvapay_enabled, qvapay_merchant_id')
        .eq('role', 'seller')
        .order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        return [];
    }
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
        <thead>
            <tr><th>Email</th><th>Nombre</th><th>Teléfono</th><th>Fecha</th><th>QvaPay</th><th>Acciones</th></tr>
        </thead>
        <tbody>
            ${solicitudes.map(s => `
            <tr>
                <td>${escapeHtml(s.email)}</td>
                <td>${escapeHtml(s.nombre_completo || '—')}</td>
                <td>${escapeHtml(s.telefono || '—')}</td>
                <td>${new Date(s.created_at).toLocaleDateString()}</td>
                <td>
                    ${s.qvapay_enabled && s.qvapay_merchant_id
            ? `<span class="badge badge-ok" title="Merchant ID: ${escapeHtml(s.qvapay_merchant_id)}"><i class="fas fa-check-circle"></i> Activado</span>`
            : `<span class="badge badge-out"><i class="fas fa-times-circle"></i> Inactivo</span>`}
                 </td>
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
    const { error } = await supabase
        .from('profiles')
        .update({ role: 'seller' })
        .eq('id', userId);
    if (error) {
        mostrarToast(`Error al aprobar a ${escapeHtml(email)}`, 'error');
    } else {
        mostrarToast(`✅ Vendedor ${escapeHtml(email)} aprobado`, 'ok');
        const solicitudes = await cargarSolicitudes();
        renderSolicitudes(solicitudes);
    }
}

async function rechazarVendedor(userId, email) {
    const { error } = await supabase
        .from('profiles')
        .update({ role: 'customer' })
        .eq('id', userId);
    if (error) {
        mostrarToast(`Error al rechazar a ${escapeHtml(email)}`, 'error');
    } else {
        mostrarToast(`❌ Vendedor ${escapeHtml(email)} rechazado`, 'info');
        const solicitudes = await cargarSolicitudes();
        renderSolicitudes(solicitudes);
    }
}

async function cargarSolicitudesYRender() {
    if (currentUserRole !== 'admin') {
        mostrarToast('Acceso denegado. Solo administradores.', 'error');
        return;
    }
    const solicitudes = await cargarSolicitudes();
    renderSolicitudes(solicitudes);
}

// ==================== CLIENTES (para administrador) ====================
async function cargarClientes() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nombre_completo, telefono, created_at, role')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        mostrarToast('Error al cargar clientes', 'error');
        return [];
    }
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
        <thead>
            <tr><th>Email</th><th>Nombre</th><th>Teléfono</th><th>Fecha registro</th><th>Acciones</th></tr>
        </thead>
        <tbody>
            ${clientes.map(c => `
            <tr>
                <td>${escapeHtml(c.email)}</td>
                <td>${escapeHtml(c.nombre_completo || '—')}</td>
                <td>${escapeHtml(c.telefono || '—')}</td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="act-btn convertir-seller" data-id="${c.id}" data-email="${escapeHtml(c.email)}">
                        <i class="fas fa-user-check"></i> Aprobar como vendedor
                    </button>
                 </td>
            </tr>`).join('')}
        </tbody>
    </table>`;
    document.querySelectorAll('.convertir-seller').forEach(btn => {
        btn.addEventListener('click', () => convertirEnVendedor(btn.dataset.id, btn.dataset.email));
    });
}

async function convertirEnVendedor(userId, email) {
    const { error } = await supabase
        .from('profiles')
        .update({ role: 'seller' })
        .eq('id', userId);
    if (error) {
        mostrarToast(`Error al aprobar a ${escapeHtml(email)}`, 'error');
    } else {
        mostrarToast(`✅ ${escapeHtml(email)} ahora es vendedor`, 'ok');
        // Recargar la lista de clientes
        const clientes = await cargarClientes();
        renderClientes(clientes);
        // Si quieres actualizar también la lista de solicitudes (por si había algo pendiente)
        const solicitudes = await cargarSolicitudes();
        renderSolicitudes(solicitudes);
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
    const categoriaSelect = document.getElementById('f-categoria');
    if (categoriaSelect) categoriaSelect.value = prod.categoria || 'Otros';
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
    const categoriaSelect = document.getElementById('f-categoria');
    if (categoriaSelect) categoriaSelect.value = 'Otros';
    document.getElementById('variantes-list').innerHTML = '';
    const previewDiv = document.getElementById('vista-previa');
    if (previewDiv) previewDiv.innerHTML = '';
    const fileInput = document.getElementById('f-imagen-file');
    if (fileInput) fileInput.value = '';
}

function agregarVariante(v = null, index = null) {
    const div = document.createElement('div');
    div.className = 'variante-item';
    div.innerHTML = `
        <button class="btn-rm-variante" type="button"><i class="fas fa-times"></i></button>
        <div class="variante-fila">
            <div class="form-group"><label>Nombre</label><input type="text" class="var-nombre" placeholder="Ej: Rojo, XL" value="${escapeHtml(v?.nombre || '')}"></div>
            <div class="form-group"><label>Precio (CUP)</label><input type="number" class="var-precio" placeholder="Opcional" value="${v?.precio ?? ''}"></div>
        </div>
        <div class="variante-fila">
            <div class="form-group"><label>Stock</label><input type="number" class="var-stock" placeholder="Cantidad" value="${v?.stock ?? ''}"></div>
            <div class="form-group"><label>Imagen URL</label><input type="url" class="var-imagen" placeholder="https://..." value="${escapeHtml(v?.imagen || '')}"></div>
        </div>`;
    div.querySelector('.btn-rm-variante').addEventListener('click', () => div.remove());
    document.getElementById('variantes-list').appendChild(div);
}

function validarTelefonoCubano(tel) {
    const cleaned = tel.replace(/\s+/g, '');
    return /^5[0-9]{7}$/.test(cleaned);
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

        if (!nombre || isNaN(precio) || isNaN(stock) || !vendedor) {
            mostrarToast('Completa los campos obligatorios', 'error');
            return;
        }
        if (telefonovendedor && !validarTelefonoCubano(telefonovendedor)) {
            mostrarToast('El teléfono debe tener formato cubano: 5XXXXXXX (8 dígitos)', 'error');
            return;
        }
        if (!telefonovendedor) telefonovendedor = null;

        let imagenUrl = '';
        if (currentUserRole === 'admin') {
            imagenUrl = document.getElementById('f-imagen').value.trim();
            if (!imagenUrl) {
                mostrarToast('Debes ingresar una URL de imagen', 'error');
                return;
            }
        } else {
            imagenUrl = document.getElementById('f-imagen').value.trim();
            const fileInput = document.getElementById('f-imagen-file');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (file.size > 10 * 1024 * 1024) {
                    mostrarToast('La imagen no debe superar los 10MB', 'error');
                    return;
                }
                const uploadedUrl = await subirImagen(file, editandoId);
                if (!uploadedUrl) throw new Error('No se pudo subir la imagen');
                imagenUrl = uploadedUrl;
                document.getElementById('f-imagen').value = imagenUrl;
            } else if (!imagenUrl) {
                mostrarToast('Debes seleccionar una imagen', 'error');
                return;
            }
        }

        const variantes = [];
        document.querySelectorAll('.variante-item').forEach(item => {
            const nombreVar = item.querySelector('.var-nombre')?.value.trim();
            if (!nombreVar) return;
            const precioVar = parseFloat(item.querySelector('.var-precio')?.value);
            const stockVar = parseInt(item.querySelector('.var-stock')?.value);
            const imagenVar = item.querySelector('.var-imagen')?.value.trim();
            variantes.push({
                nombre: nombreVar,
                precio: isNaN(precioVar) ? null : precioVar,
                stock: isNaN(stockVar) ? 0 : stockVar,
                imagen: imagenVar || null
            });
        });

        if (!currentUser) throw new Error('Usuario no autenticado');

        const productoData = {
            nombre, precio, stock, imagen: imagenUrl, vendedor, telefonovendedor,
            enoferta: enOferta, preciooferta: precioOferta, categoria,
            variantes: variantes.length ? variantes : [],
            seller_id: currentUser.id
        };

        let error;
        if (editandoId) {
            const { error: updateError } = await supabase.from('productos').update(productoData).eq('id', editandoId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('productos').insert([productoData]);
            error = insertError;
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
    document.getElementById('modal-borrar').setAttribute('hidden', '');
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
            const { data: pedidos, error } = await supabase.from('pedidos').select('id, productos');
            if (error) throw error;
            const tienePedidos = pedidos.some(pedido => {
                if (!pedido.productos || !Array.isArray(pedido.productos)) return false;
                return pedido.productos.some(item => item.id === borrandoId);
            });
            if (tienePedidos) {
                mostrarToast('❌ No se puede eliminar: el producto tiene pedidos asociados.', 'error');
                confirmarBtn.disabled = false;
                confirmarBtn.innerHTML = textoOriginal;
                return;
            }
        }
        const { error } = await supabase.from('productos').delete().eq('id', borrandoId);
        if (error) throw error;
        mostrarToast('Producto eliminado', 'ok');
        localStorage.removeItem('productos_cache');
        localStorage.removeItem('productos_cache_time');
        cerrarBorrar();
        cargarProductos();
    } catch (err) {
        mostrarToast(err.message || 'Error al eliminar producto', 'error');
        confirmarBtn.disabled = false;
        confirmarBtn.innerHTML = textoOriginal;
    }
}