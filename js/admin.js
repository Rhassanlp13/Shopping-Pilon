import { escapeHtml } from './utils/escape.js';
import { supabase } from './supabase.js';
import { mostrarToast } from './modules/toast.js';

let productos = [];
let pedidos = [];
let resenas = [];
let editandoId = null;
let borrandoId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/';
        return;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'seller')) {
        window.location.href = '/';
        return;
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
});

async function iniciar() {
    await cargarProductos();
    const buscador = document.getElementById('buscador');
    if (buscador) buscador.addEventListener('input', e => renderTabla(e.target.value.trim().toLowerCase()));
}

// ======================== PRODUCTOS ========================
async function cargarProductos() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No hay usuario autenticado');
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const isAdmin = profile?.role === 'admin';
        let query = supabase.from('productos').select('*');
        if (!isAdmin) query = query.eq('seller_id', user.id);
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
    if (statsDiv) statsDiv.innerHTML = `<div class="stat-card"><div class="stat-label">Total</div><div class="stat-val">${total}</div></div><div class="stat-card"><div class="stat-label">Sin stock</div><div class="stat-val" style="color:var(--danger)">${sinStk}</div></div><div class="stat-card"><div class="stat-label">Stock bajo</div><div class="stat-val" style="color:var(--warning)">${bajo}</div></div><div class="stat-card"><div class="stat-label">Con variantes</div><div class="stat-val">${conVar}</div></div><div class="stat-card"><div class="stat-label">En oferta</div><div class="stat-val" style="color:var(--danger)">${ofertas}</div></div>`;
}

function renderTabla(filtro = '') {
    const lista = filtro ? productos.filter(p => p.nombre?.toLowerCase().includes(filtro) || p.vendedor?.toLowerCase().includes(filtro)) : productos;
    const tablaDiv = document.getElementById('tabla-productos');
    if (!tablaDiv) return;
    if (lista.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-box-open"></i><p>${filtro ? 'Sin resultados' : 'No hay productos aún'}</p></div>`;
        return;
    }
    tablaDiv.innerHTML = `<table class="admin-table"><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Oferta</th><th>Variantes</th><th>Acciones</th></tr></thead><tbody>${lista.map(p => `
        <tr>
            <td><img src="${escapeHtml(p.imagen)}" class="prod-thumb" onerror="this.src='https://placehold.co/36x36?text=?'"><span><div class="prod-name">${escapeHtml(p.nombre)}</div><div class="prod-vendedor">${escapeHtml(p.vendedor)}</div></span></td>
            <td>$${Number(p.precio).toLocaleString('es-CU')} CUP</td>
            <td>${p.stock <= 0 ? '<span class="badge badge-out">Agotado</span>' : p.stock <= 3 ? `<span class="badge badge-low">${p.stock} uds</span>` : `<span class="badge badge-ok">${p.stock} uds</span>`}</td>
            <td>${p.enoferta && p.preciooferta ? `<span class="badge" style="background:#ffebee;color:#c62828">$${Number(p.preciooferta).toLocaleString('es-CU')}</span>` : '—'}</td>
            <td>${p.variantes?.length > 0 ? `<span class="badge badge-variant">${p.variantes.length} var.</span>` : '—'}</td>
            <td><div class="actions"><button class="act-btn" data-edit="${p.id}"><i class="fas fa-pen"></i> Editar</button><button class="act-btn del" data-del="${p.id}" data-nombre="${escapeHtml(p.nombre)}"><i class="fas fa-trash"></i></button></div></td>
        </tr>`).join('')}</tbody></table>`;
    document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => abrirEditar(btn.dataset.edit)));
    document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => abrirBorrar(btn.dataset.del, btn.dataset.nombre)));
}

// ======================== PEDIDOS ========================
async function cargarPedidos() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const isAdmin = profile?.role === 'admin';
        let query = supabase.from('pedidos').select('*');
        if (!isAdmin) query = query.eq('vendedor_id', user.id);
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
    tablaDiv.innerHTML = `<table class="admin-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Productos</th><th>Acciones</th></tr></thead><tbody>${pedidos.map(p => `
        <tr>
            <td>${escapeHtml(p.cliente_nombre)}</td>
            <td>${escapeHtml(p.cliente_telefono)}</td>
            <td>${new Date(p.created_at).toLocaleString()}</td>
            <td>$${Number(p.total).toLocaleString('es-CU')}</td>
            <td><span class="badge ${p.status === 'pendiente' ? 'badge-low' : 'badge-ok'}">${p.status === 'pendiente' ? 'Pendiente' : 'Confirmado'}</span></td>
            <td><ul>${p.productos.map(prod => `<li>${escapeHtml(prod.nombre)} x${prod.cantidad} - $${Number(prod.precio * prod.cantidad).toLocaleString('es-CU')}</li>`).join('')}</ul></td>
            <td>${p.status === 'pendiente' ? `<button class="act-btn confirmar-pedido" data-id="${escapeHtml(p.id)}">Confirmar</button>` : '—'}</td>
        </tr>`).join('')}</tbody></table>`;
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
        } else {
            throw new Error(data?.error || 'Error al confirmar el pedido');
        }
    } catch (err) {
        mostrarToast(`Error: ${err.message}`, 'error');
    }
}

// ======================== RESEÑAS (solo admin) ========================
async function cargarResenas() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
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
    tablaDiv.innerHTML = `<table class="admin-table"><thead><tr><th>Producto ID</th><th>Nombre</th><th>Estrellas</th><th>Comentario</th><th>Fecha</th></tr></thead><tbody>${resenas.map(r => `
        <tr>
            <td>${escapeHtml(r.productoid)}</td>
            <td>${escapeHtml(r.nombre)}</td>
            <td>${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}</td>
            <td>${escapeHtml(r.texto)}</td>
            <td>${new Date(r.fecha).toLocaleDateString()}</td>
        </tr>`).join('')}</tbody></table>`;
}

// ======================== CRUD PRODUCTOS ========================
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
    document.getElementById('f-precio-oferta').value = prod.preciooferta || '';
    document.getElementById('f-en-oferta').checked = prod.enoferta || false;
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
    document.getElementById('variantes-list').innerHTML = '';
}

function agregarVariante(v = null, index = null) {
    const div = document.createElement('div');
    div.className = 'variante-item';
    div.innerHTML = `<button class="btn-rm-variante" type="button"><i class="fas fa-times"></i></button><div class="variante-fila"><div class="form-group"><label>Nombre</label><input type="text" class="var-nombre" placeholder="Ej: Rojo, XL" value="${escapeHtml(v?.nombre || '')}"></div><div class="form-group"><label>Precio (CUP)</label><input type="number" class="var-precio" placeholder="Opcional" value="${v?.precio || ''}"></div></div><div class="variante-fila"><div class="form-group"><label>Stock</label><input type="number" class="var-stock" placeholder="Cantidad" value="${v?.stock || ''}"></div><div class="form-group"><label>Imagen URL</label><input type="url" class="var-imagen" placeholder="https://..." value="${escapeHtml(v?.imagen || '')}"></div></div>`;
    div.querySelector('.btn-rm-variante').addEventListener('click', () => div.remove());
    document.getElementById('variantes-list').appendChild(div);
}

function validarTelefonoCubano(tel) {
    const cleaned = tel.replace(/\s+/g, '');
    const regex = /^5[0-9]{7}$/; // 5 + 7 dígitos = 8 dígitos
    return regex.test(cleaned);
}

async function guardarProducto() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const precio = parseFloat(document.getElementById('f-precio').value);
    const stock = parseInt(document.getElementById('f-stock').value);
    const vendedor = document.getElementById('f-vendedor').value.trim();
    let telefonovendedor = document.getElementById('f-telefono-vendedor').value.trim();
    const imagen = document.getElementById('f-imagen').value.trim();
    const enOferta = document.getElementById('f-en-oferta').checked;
    const precioOferta = enOferta ? parseFloat(document.getElementById('f-precio-oferta').value) : null;

    if (!nombre || isNaN(precio) || isNaN(stock) || !vendedor || !imagen) {
        mostrarToast('Completa los campos obligatorios', 'error');
        return;
    }
    if (telefonovendedor && !validarTelefonoCubano(telefonovendedor)) {
        mostrarToast('El teléfono del vendedor debe tener formato cubano: 5XXXXXXX (8 dígitos)', 'error');
        return;
    }
    if (!telefonovendedor) telefonovendedor = null;

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        mostrarToast('Debes iniciar sesión', 'error');
        return;
    }

    const productoData = {
        nombre,
        precio,
        stock,
        imagen,
        vendedor,
        telefonovendedor,
        enoferta: enOferta,
        preciooferta: precioOferta,
        variantes: variantes.length ? variantes : [],
        seller_id: user.id
    };

    let error;
    if (editandoId) {
        const { error: updateError } = await supabase.from('productos').update(productoData).eq('id', editandoId);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('productos').insert([productoData]);
        error = insertError;
    }

    if (error) {
        mostrarToast('Error al guardar producto', 'error');
    } else {
        mostrarToast('Producto guardado', 'ok');
        cerrarModal();
        cargarProductos();
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
    const { error } = await supabase.from('productos').delete().eq('id', borrandoId);
    if (error) {
        mostrarToast('Error al eliminar', 'error');
    } else {
        mostrarToast('Producto eliminado', 'ok');
        cerrarBorrar();
        cargarProductos();
    }
}
