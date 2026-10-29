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
                // CAMBIADO A JPG PARA COMPATIBILIDAD CON WHATSAPP
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82);
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
        // Extensión cambiada a .jpg
        const nombreArchivo = productoId ? `${productoId}_${Date.now()}.jpg` : `temp_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
            .from('products')
            .upload(nombreArchivo, blobOptimizado, { 
                contentType: 'image/jpeg', // Cambiado a jpeg
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

async function subirLogo(file) {
    if (!file) return null;
    try {
        const blobOptimizado = await resizeAndOptimizeImage(file, 400, 400);
        // Extensión cambiada a .jpg
        const nombreArchivo = `logos/${currentUser.id}_${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from('products')
            .upload(nombreArchivo, blobOptimizado, {
                contentType: 'image/jpeg', // Cambiado a jpeg
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

function actualizarPreviewTasa() {
    const tasa = parseFloat(document.getElementById('mi-tasa-cambio')?.value) || 0;
    const valorEl = document.getElementById('tasa-preview-valor');
    const ejemploEl = document.getElementById('tasa-preview-ejemplo');

    if (valorEl) valorEl.textContent = tasa.toLocaleString('es');
    if (ejemploEl) {
        const ejemplo = Math.round(100 * tasa / 100) * 100;
        ejemploEl.textContent = `$${ejemplo.toLocaleString('es')} CUP`;
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
            .select('nombre_tienda, nombre_completo, municipio, logo_tienda, tasa_cambio')
            .eq('id', currentUser.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;

        const nombreInput = document.getElementById('mi-nombre-tienda');
        const municipioSelect = document.getElementById('mi-municipio');
        const tasaInput = document.getElementById('mi-tasa-cambio');

        if (nombreInput) nombreInput.value = data?.nombre_tienda || data?.nombre_completo || '';
        if (municipioSelect) municipioSelect.value = data?.municipio || '';
        if (tasaInput) tasaInput.value = data?.tasa_cambio || 250;

        logoPendiente = null;
        logoEliminar = false;
        logoActualUrl = data?.logo_tienda || null;

        const logoInput = document.getElementById('mi-logo-input');
        if (logoInput) logoInput.value = '';

        renderLogoPreview();
        actualizarPreviewTienda();
        actualizarPreviewTasa();
    } catch (err) {
        console.error(err);
        mostrarToast('Error al cargar tu tienda', 'error');
    }
}

async function guardarMiTienda() {
    const btn = document.getElementById('guardar-mi-tienda');
    const nombreTienda = document.getElementById('mi-nombre-tienda')?.value.trim();
    const municipio = document.getElementById('mi-municipio')?.value;
    const tasaCambio = parseFloat(document.getElementById('mi-tasa-cambio')?.value) || 250;

    if (!nombreTienda) { mostrarToast('Escribe un nombre para tu tienda', 'error'); return; }
    if (!municipio) { mostrarToast('Selecciona tu municipio', 'error'); return; }
    if (tasaCambio <= 0) { mostrarToast('Ingresa una tasa de cambio válida', 'error'); return; }

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
                logo_tienda: logoUrl,
                tasa_cambio: tasaCambio,
                tasa_actualizada: new Date().toISOString()
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
        localStorage.removeItem('tasa_usd_cup');
        localStorage.removeItem('tasa_usd_cup_time');

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
    document.getElementById('mi-tasa-cambio')?.addEventListener('input', actualizarPreviewTasa);
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
          
