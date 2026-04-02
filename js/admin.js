import { supabase } from './supabase.js';

let productos = [];
let pedidos = [];
let editandoId = null;
let borrandoId = null;

// ========== ESCAPE HTML (XSS protection) ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ========== Obtener usuario actual ==========
async function getCurrentUser(maxRetries = 2) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (session?.user) return session.user;
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
            console.warn(`Intento ${i + 1} fallido:`, err.message);
            if (i === maxRetries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
    throw new Error('No se pudo obtener el usuario');
}

// ========== Verificar rol vendedor ==========
async function verificarRolVendedor() {
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (error || data?.role !== 'seller') {
            toast('Acceso denegado. Solo vendedores pueden usar el panel.', 'error');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);
            return false;
        }
        return true;
    } catch (err) {
        toast('Error verificando permisos', 'error');
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado');
    const loginWrap = document.getElementById('login-wrap');
    const shell = document.getElementById('shell');

    if (!loginWrap || !shell) {
        console.error('❌ Elementos login-wrap o shell no encontrados');
        return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
            const esVendedor = await verificarRolVendedor();
            if (esVendedor) {
                loginWrap.style.display = 'none';
                shell.classList.add('visible');
                iniciar();
            }
        }
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            const esVendedor = await verificarRolVendedor();
            if (esVendedor) {
                loginWrap.style.display = 'none';
                shell.classList.add('visible');
                iniciar();
            }
        } else {
            loginWrap.style.display = 'flex';
            shell.classList.remove('visible');
        }
    });

    const btnLogin = document.getElementById('btn-login');
    btnLogin?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-pass').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            document.getElementById('login-error').classList.add('show');
            document.getElementById('login-pass').value = '';
        } else {
            document.getElementById('login-error').classList.remove('show');
            loginWrap.style.display = 'none';
            shell.classList.add('visible');
            iniciar();
        }
    });

    document.getElementById('login-pass')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btn-login').click();
    });

    const btnLogout = document.getElementById('btn-logout');
    btnLogout?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.reload();
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

    const btnRegistro = document.getElementById('btn-registro');
    btnRegistro?.addEventListener('click', async () => {
        const email = prompt('Correo electrónico para tu cuenta:');
        if (!email) return;
        const password = prompt('Contraseña (mínimo 6 caracteres):');
        if (!password) return;
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) toast(error.message, 'error');
        else toast('Registro exitoso. Revisa tu correo para confirmar.', 'ok');
    });
});

async function iniciar() {
    await cargarProductos();
    const buscador = document.getElementById('buscador');
    if (buscador) {
        buscador.addEventListener('input', e => {
            renderTabla(e.target.value.trim().toLowerCase());
        });
    }
}

// ================= PRODUCTOS =================
async function cargarProductos() {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('No hay usuario autenticado');
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        productos = data;
        renderStats();
        renderTabla();
    } catch (err) {
        console.error('[admin] cargarProductos:', err);
        toast('Error al cargar productos: ' + err.message, 'error');
    }
}

function renderStats() {
    const total = productos.length;
    const sinStk = productos.filter(p => p.stock <= 0).length;
    const bajo = productos.filter(p => p.stock > 0 && p.stock <= 3).length;
    const conVar = productos.filter(p => p.variantes?.length > 0).length;
    const ofertas = productos.filter(p => p.enoferta && p.preciooferta).length;

    const statsDiv = document.getElementById('stats-productos');
    if (!statsDiv) return;
    statsDiv.innerHTML = `
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-val">${total}</div></div>
        <div class="stat-card"><div class="stat-label">Sin stock</div><div class="stat-val" style="color:var(--danger)">${sinStk}</div></div>
        <div class="stat-card"><div class="stat-label">Stock bajo</div><div class="stat-val" style="color:var(--warning)">${bajo}</div></div>
        <div class="stat-card"><div class="stat-label">Con variantes</div><div class="stat-val">${conVar}</div></div>
        <div class="stat-card"><div class="stat-label">En oferta</div><div class="stat-val" style="color:var(--danger)">${ofertas}</div></div>
    `;
}

function renderTabla(filtro = '') {
    const lista = filtro
        ? productos.filter(p => p.nombre?.toLowerCase().includes(filtro) || p.vendedor?.toLowerCase().includes(filtro))
        : productos;
    const tablaDiv = document.getElementById('tabla-productos');
    if (!tablaDiv) return;

    if (lista.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-box-open"></i><p>${filtro ? 'Sin resultados' : 'No hay productos aún'}</p></div>`;
        return;
    }

    tablaDiv.innerHTML = `
        <table>
            <thead>
                <tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Oferta</th><th>Variantes</th><th>Acciones</th></tr>
            </thead>
            <tbody>
                ${lista.map(p => {
                    const stockBadge = p.stock <= 0 ? `<span class="badge badge-out">Agotado</span>` : p.stock <= 3 ? `<span class="badge badge-low">${p.stock} uds</span>` : `<span class="badge badge-ok">${p.stock} uds</span>`;
                    const varBadge = p.variantes?.length > 0 ? `<span class="badge badge-variant">${p.variantes.length} var.</span>` : '<span style="color:#bbb">—</span>';
                    const ofertaBadge = p.enoferta && p.preciooferta ? `<span class="badge" style="background:#ffebee;color:#c62828">$${Number(p.preciooferta).toLocaleString('es-CU')}</span>` : '<span style="color:#bbb">—</span>';
                    return `
                        <tr>
                            <td><img src="${escapeHtml(p.imagen)}" class="prod-thumb" onerror="this.src='https://placehold.co/36x36?text=?'" alt="${escapeHtml(p.nombre)}"><span><div class="prod-name">${escapeHtml(p.nombre)}</div><div class="prod-vendedor">${escapeHtml(p.vendedor)}</div></span></td>
                            <td>$${Number(p.precio).toLocaleString('es-CU')} CUP</td>
                            <td>${stockBadge}</td>
                            <td>${ofertaBadge}</td>
                            <td>${varBadge}</td>
                            <td><div class="actions"><button class="act-btn" data-edit="${p.id}"><i class="fas fa-pen"></i> Editar</button><button class="act-btn del" data-del="${p.id}" data-nombre="${escapeHtml(p.nombre)}"><i class="fas fa-trash"></i></button></div></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => abrirEditar(btn.dataset.edit)));
    document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => abrirBorrar(btn.dataset.del, btn.dataset.nombre)));
}

// ================= PEDIDOS =================
async function cargarPedidos() {
    try {
        const user = await getCurrentUser();
        if (!user) return;
        const { data, error } = await supabase
            .from('pedidos')
            .select('*')
            .eq('vendedor_id', user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        pedidos = data;
        renderPedidos();
    } catch (err) {
        console.error('[admin] cargarPedidos:', err);
        toast('Error al cargar pedidos', 'error');
    }
}

function renderPedidos() {
    const tablaDiv = document.getElementById('tabla-pedidos');
    if (!tablaDiv) return;

    if (!pedidos || pedidos.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-truck"></i><p>No hay pedidos aún</p></div>`;
        return;
    }

    tablaDiv.innerHTML = `
        <table>
            <thead>
                <tr><th>Cliente</th><th>Teléfono</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Productos</th><th>Acciones</th></tr>
            </thead>
            <tbody>
                ${pedidos.map(p => `
                    <tr>
                        <td>${escapeHtml(p.cliente_nombre)}</td>
                        <td>${escapeHtml(p.cliente_telefono)}</td>
                        <td>${new Date(p.created_at).toLocaleString()}</td>
                        <td>$${Number(p.total).toLocaleString('es-CU')}</td>
                        <td><span class="badge ${p.status === 'pendiente' ? 'badge-low' : 'badge-ok'}">${p.status === 'pendiente' ? 'Pendiente' : 'Confirmado'}</span></td>
                        <td><ul>${p.productos.map(prod => `<li>${escapeHtml(prod.nombre)} x${prod.cantidad} - $${Number(prod.precio * prod.cantidad).toLocaleString('es-CU')}</li>`).join('')}</ul></td>
                        <td>${p.status === 'pendiente' ? `<button class="act-btn confirmar-pedido" data-id="${p.id}">Confirmar</button>` : '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.querySelectorAll('.confirmar-pedido').forEach(btn => {
        btn.addEventListener('click', () => confirmarPedido(btn.dataset.id));
    });
}

async function confirmarPedido(pedidoId) {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;
    const productos = pedido.productos;

    try {
        for (const item of productos) {
            const { data: product, error: fetchError } = await supabase
                .from('productos')
                .select('stock, variantes')
                .eq('id', item.id)
                .single();
            if (fetchError || !product) throw new Error(`Producto no encontrado: ${item.id}`);

            if (item.variantId !== null && item.variantId !== undefined) {
                const variant = product.variantes?.[item.variantId];
                if (!variant) throw new Error(`Variante no encontrada en producto ${item.id}`);
                if (variant.stock < item.cantidad) throw new Error(`Stock insuficiente para ${item.nombre}`);
                const newVariantes = [...product.variantes];
                newVariantes[item.variantId] = { ...variant, stock: variant.stock - item.cantidad };
                await supabase.from('productos').update({ variantes: newVariantes }).eq('id', item.id);
            } else {
                if (product.stock < item.cantidad) throw new Error(`Stock insuficiente para ${item.nombre}`);
                await supabase.from('productos').update({ stock: product.stock - item.cantidad }).eq('id', item.id);
            }
        }
        await supabase.from('pedidos').update({ status: 'confirmado', confirmed_at: new Date().toISOString() }).eq('id', pedidoId);
        toast('Pedido confirmado y stock actualizado', 'ok');
        cargarPedidos();
        cargarProductos();
    } catch (err) {
        console.error('Error confirmando pedido:', err);
        toast(`Error: ${err.message}`, 'error');
    }
}

// ================= RESEÑAS =================
async function cargarResenas() {
    try {
        const { data, error } = await supabase
            .from('reseñas')
            .select('*')
            .order('fecha', { ascending: false });
        if (error) throw error;

        const tablaResenas = document.getElementById('tabla-resenas');
        if (!tablaResenas) return;

        if (data.length === 0) {
            tablaResenas.innerHTML = `<div class="table-empty"><i class="fas fa-comment-slash"></i><p>No hay reseñas aún</p></div>`;
            return;
        }

        tablaResenas.innerHTML = `
            <table>
                <thead>
                    <tr><th>Autor</th><th>Estrellas</th><th>Opinión</th><th>Fecha</th><th></th></tr>
                </thead>
                <tbody>
                    ${data.map(r => `
                        <tr>
                            <td><strong>${escapeHtml(r.nombre)}</strong></td>
                            <td style="color:#ff9800;letter-spacing:2px">${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}</td>
                            <td style="max-width:220px;font-size:0.85rem">${escapeHtml(r.texto)}</td>
                            <td style="font-size:0.8rem;color:var(--muted);white-space:nowrap">${new Date(r.fecha).toLocaleDateString('es-CU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td><button class="act-btn del" data-del-resena="${r.id}"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.querySelectorAll('[data-del-resena]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar esta reseña?')) return;
                const { error } = await supabase.from('reseñas').delete().eq('id', btn.dataset.delResena);
                if (error) throw error;
                toast('Reseña eliminada', 'ok');
                cargarResenas();
            });
        });
    } catch (err) {
        console.error('[admin] cargarResenas:', err);
        const tablaResenas = document.getElementById('tabla-resenas');
        if (tablaResenas) {
            tablaResenas.innerHTML = `<div class="table-empty"><i class="fas fa-wifi"></i><p>Error al cargar reseñas</p></div>`;
        }
    }
}

// ================= FUNCIONES AUXILIARES =================
const modalProducto = document.getElementById('modal-producto');

function abrirNuevo() {
    editandoId = null;
    document.getElementById('modal-titulo').textContent = 'Nuevo producto';
    limpiarForm();
    modalProducto.removeAttribute('hidden');
}

function abrirEditar(id) {
    const p = productos.find(p => p.id === id);
    if (!p) return;
    editandoId = id;
    document.getElementById('modal-titulo').textContent = 'Editar producto';
    document.getElementById('f-nombre').value = p.nombre ?? '';
    document.getElementById('f-precio').value = p.precio ?? '';
    document.getElementById('f-stock').value = p.stock ?? '';
    document.getElementById('f-vendedor').value = p.vendedor ?? '';
    document.getElementById('f-imagen').value = p.imagen ?? '';
    document.getElementById('f-telefono-vendedor').value = p.telefonovendedor ?? '';
    document.getElementById('f-precio-oferta').value = p.preciooferta ?? '';
    document.getElementById('f-en-oferta').checked = p.enoferta ?? false;
    document.getElementById('variantes-list').innerHTML = '';
    (p.variantes ?? []).forEach(v => agregarFilaVariante(v));
    modalProducto.removeAttribute('hidden');
}

function limpiarForm() {
    ['f-nombre', 'f-precio', 'f-stock', 'f-vendedor', 'f-imagen', 'f-telefono-vendedor', 'f-precio-oferta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const chk = document.getElementById('f-en-oferta');
    if (chk) chk.checked = false;
    const varList = document.getElementById('variantes-list');
    if (varList) varList.innerHTML = '';
}

function cerrarModal() {
    modalProducto.setAttribute('hidden', '');
    editandoId = null;
}

const btnNuevo = document.getElementById('btn-nuevo');
if (btnNuevo) btnNuevo.addEventListener('click', abrirNuevo);
const modalCerrar = document.getElementById('modal-cerrar');
if (modalCerrar) modalCerrar.addEventListener('click', cerrarModal);
const btnCancelar = document.getElementById('btn-cancelar');
if (btnCancelar) btnCancelar.addEventListener('click', cerrarModal);

function agregarFilaVariante(v = {}) {
    const div = document.createElement('div');
    div.className = 'variante-item';
    div.innerHTML = `
        <button class="btn-rm-variante" title="Eliminar variante"><i class="fas fa-times"></i></button>
        <div class="variante-fila">
            <div><div class="variante-label">Nombre</div><input type="text" placeholder="Ej: Rojo, Talla M..." value="${escapeHtml(v.nombre ?? '')}" data-campo="nombre"></div>
            <div><div class="variante-label">URL de foto</div><input type="url" placeholder="https://foto.jpg" value="${escapeHtml(v.imagen ?? '')}" data-campo="imagen"></div>
        </div>
        <div class="variante-fila">
            <div><div class="variante-label">Precio (CUP)</div><input type="number" placeholder="Precio" value="${v.precio ?? ''}" data-campo="precio" min="0"></div>
            <div><div class="variante-label">Stock</div><input type="number" placeholder="Stock" value="${v.stock ?? ''}" data-campo="stock" min="0"></div>
        </div>
    `;
    div.querySelector('.btn-rm-variante').addEventListener('click', () => div.remove());
    document.getElementById('variantes-list').appendChild(div);
}

const btnAddVariante = document.getElementById('btn-add-variante');
if (btnAddVariante) btnAddVariante.addEventListener('click', () => agregarFilaVariante());

document.getElementById('btn-guardar').addEventListener('click', async () => {
    const nombre = document.getElementById('f-nombre').value.trim();
    const precio = Number(document.getElementById('f-precio').value);
    const stock = Number(document.getElementById('f-stock').value);
    const vendedor = document.getElementById('f-vendedor').value.trim();
    const imagen = document.getElementById('f-imagen').value.trim();
    const telefonoVendedor = document.getElementById('f-telefono-vendedor').value.trim();
    const precioOferta = Number(document.getElementById('f-precio-oferta').value) || null;
    const enOferta = document.getElementById('f-en-oferta').checked;

    if (!nombre || !precio || !vendedor || !imagen) {
        toast('Completa todos los campos obligatorios', 'error');
        return;
    }

    const variantes = [];
    document.querySelectorAll('#variantes-list .variante-item').forEach(row => {
        const get = campo => row.querySelector(`[data-campo="${campo}"]`).value.trim();
        const nv = get('nombre');
        const iv = get('imagen');
        if (nv && iv) {
            variantes.push({
                nombre: nv,
                imagen: iv,
                precio: Number(get('precio')) || precio,
                stock: Number(get('stock')) || stock,
            });
        }
    });

    const user = await getCurrentUser();
    if (!user) {
        toast('Debes iniciar sesión', 'error');
        return;
    }

    const datos = {
        nombre,
        precio,
        stock,
        vendedor,
        imagen,
        telefonovendedor: telefonoVendedor,
        preciooferta: precioOferta,
        enoferta: enOferta
    };
    if (variantes.length > 0) datos.variantes = variantes;

    if (!editandoId) {
        datos.seller_id = user.id;
    }

    const btn = document.getElementById('btn-guardar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        if (editandoId) {
            const { error } = await supabase.from('productos').update(datos).eq('id', editandoId);
            if (error) throw error;
            toast('Producto actualizado', 'ok');
        } else {
            const { error } = await supabase.from('productos').insert([datos]);
            if (error) throw error;
            toast('Producto creado', 'ok');
        }
        cerrarModal();
        await cargarProductos();
    } catch (err) {
        console.error('[admin] guardar:', err);
        toast('Error al guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
});

const modalBorrar = document.getElementById('modal-borrar');

function abrirBorrar(id, nombre) {
    borrandoId = id;
    document.getElementById('borrar-nombre').textContent = nombre;
    modalBorrar.removeAttribute('hidden');
}

if (modalBorrar) {
    const borrarCerrar = document.getElementById('borrar-cerrar');
    if (borrarCerrar) borrarCerrar.addEventListener('click', () => modalBorrar.setAttribute('hidden', ''));
    const borrarCancelar = document.getElementById('borrar-cancelar');
    if (borrarCancelar) borrarCancelar.addEventListener('click', () => modalBorrar.setAttribute('hidden', ''));
}

document.getElementById('borrar-confirmar').addEventListener('click', async () => {
    if (!borrandoId) return;
    const btn = document.getElementById('borrar-confirmar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const { error } = await supabase.from('productos').delete().eq('id', borrandoId);
        if (error) throw error;
        modalBorrar.setAttribute('hidden', '');
        toast('Producto eliminado', 'ok');
        await cargarProductos();
    } catch (err) {
        console.error('[admin] borrar:', err);
        toast('Error al eliminar. Revisa las reglas de seguridad', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        borrandoId = null;
    }
});

function toast(msg, tipo = 'info') {
    const container = document.getElementById('toast-admin');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 2500);
}