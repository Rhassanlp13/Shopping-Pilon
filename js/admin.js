import { supabase } from './supabase.js';

let productos = [];
let pedidos = [];
let editandoId = null;
let borrandoId = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado');

    const loginWrap = document.getElementById('login-wrap');
    const shell = document.getElementById('shell');

    if (!loginWrap || !shell) {
        console.error('❌ Elementos login-wrap o shell no encontrados');
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            loginWrap.style.display = 'none';
            shell.classList.add('visible');
            iniciar();
        }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            loginWrap.style.display = 'none';
            shell.classList.add('visible');
            iniciar();
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
        const { data: { user } } = await supabase.auth.getUser();
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
        toast('Error al cargar productos', 'error');
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
            <thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Oferta</th><th>Variantes</th><th>Acciones</th></tr></thead>
            <tbody>
                ${lista.map(p => {
                    const stockBadge = p.stock <= 0 ? `<span class="badge badge-out">Agotado</span>` : p.stock <= 3 ? `<span class="badge badge-low">${p.stock} uds</span>` : `<span class="badge badge-ok">${p.stock} uds</span>`;
                    const varBadge = p.variantes?.length > 0 ? `<span class="badge badge-variant">${p.variantes.length} var.</span>` : '<span style="color:#bbb">—</span>';
                    const ofertaBadge = p.enoferta && p.preciooferta ? `<span class="badge" style="background:#ffebee;color:#c62828">$${Number(p.preciooferta).toLocaleString('es-CU')}</span>` : '<span style="color:#bbb">—</span>';
                    return `
                        <tr>
                            <td><img src="${p.imagen}" class="prod-thumb" onerror="this.src='https://placehold.co/36x36?text=?'" alt="${p.nombre}"><span><div class="prod-name">${p.nombre}</div><div class="prod-vendedor">${p.vendedor}</div></span></td>
                            <td>$${Number(p.precio).toLocaleString('es-CU')} CUP</td>
                            <td>${stockBadge}</td>
                            <td>${ofertaBadge}</td>
                            <td>${varBadge}</td>
                            <td><div class="actions"><button class="act-btn" data-edit="${p.id}"><i class="fas fa-pen"></i> Editar</button><button class="act-btn del" data-del="${p.id}" data-nombre="${p.nombre}"><i class="fas fa-trash"></i></button></div></td>
                        </tr>`;
                }).join('')}
            </tbody>
        </table>`;

    document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => abrirEditar(btn.dataset.edit)));
    document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => abrirBorrar(btn.dataset.del, btn.dataset.nombre)));
}

// ================= PEDIDOS =================
async function cargarPedidos() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
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

    if (pedidos.length === 0) {
        tablaDiv.innerHTML = `<div class="table-empty"><i class="fas fa-truck"></i><p>No hay pedidos aún</p></div>`;
        return;
    }

    tablaDiv.innerHTML = `
        <table>
            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Productos</th><th>Acciones</th></tr></thead>
            <tbody>
                ${pedidos.map(p => `
                    <tr>
                        <td>${p.cliente_nombre}</td>
                        <td>${p.cliente_telefono}</td>
                        <td>${new Date(p.created_at).toLocaleString()}</td>
                        <td>$${Number(p.total).toLocaleString('es-CU')}</td>
                        <td><span class="badge ${p.status === 'pendiente' ? 'badge-low' : 'badge-ok'}">${p.status === 'pendiente' ? 'Pendiente' : 'Confirmado'}</span></td>
                        <td><ul>${p.productos.map(prod => `<li>${prod.nombre} x${prod.cantidad} - $${Number(prod.precio * prod.cantidad).toLocaleString('es-CU')}</li>`).join('')}</ul></td>
                        <td>${p.status === 'pendiente' ? `<button class="act-btn confirmar-pedido" data-id="${p.id}">Confirmar</button>` : '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;

    document.querySelectorAll('.confirmar-pedido').forEach(btn => {
        btn.addEventListener('click', () => confirmarPedido(btn.dataset.id));
    });
}

async function confirmarPedido(pedidoId) {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    const productos = pedido.productos;
    const updates = []; // para rollback

    try {
        for (const item of productos) {
            // Obtener producto actual
            const { data: product, error: fetchError } = await supabase
                .from('productos')
                .select('stock, variantes')
                .eq('id', item.id)
                .single();
            if (fetchError || !product) throw new Error(`Producto no encontrado: ${item.id}`);

            let updateField;
            let originalStock;
            if (item.variantId !== null && item.variantId !== undefined) {
                const variant = product.variantes?.[item.variantId];
                if (!variant) throw new Error(`Variante no encontrada en producto ${item.id}`);
                if (variant.stock < item.cantidad) throw new Error(`Stock insuficiente para ${item.nombre}`);
                const newVariantes = [...product.variantes];
                newVariantes[item.variantId] = { ...variant, stock: variant.stock - item.cantidad };
                updateField = { variantes: newVariantes };
                originalStock = variant.stock;
            } else {
                if (product.stock < item.cantidad) throw new Error(`Stock insuficiente para ${item.nombre}`);
                updateField = { stock: product.stock - item.cantidad };
                originalStock = product.stock;
            }

            // Guardar para posible rollback
            updates.push({ id: item.id, variantId: item.variantId, originalStock });

            // Actualizar producto
            const { error: updateError } = await supabase
                .from('productos')
                .update(updateField)
                .eq('id', item.id);
            if (updateError) throw updateError;
        }

        // Marcar pedido como confirmado
        const { error: updateOrderError } = await supabase
            .from('pedidos')
            .update({ status: 'confirmado', confirmed_at: new Date().toISOString() })
            .eq('id', pedidoId);
        if (updateOrderError) throw updateOrderError;

        toast('Pedido confirmado y stock actualizado', 'ok');
        cargarPedidos();   // refrescar lista
        cargarProductos(); // refrescar stock en productos

    } catch (err) {
        console.error('Error confirmando pedido:', err);
        toast(`Error: ${err.message}`, 'error');
        // Rollback de actualizaciones que sí se hicieron
        for (const upd of updates) {
            const { data: current } = await supabase
                .from('productos')
                .select('stock, variantes')
                .eq('id', upd.id)
                .single();
            if (current) {
                if (upd.variantId !== null && upd.variantId !== undefined) {
                    const variant = current.variantes?.[upd.variantId];
                    if (variant) {
                        const newVariantes = [...current.variantes];
                        newVariantes[upd.variantId] = { ...variant, stock: upd.originalStock };
                        await supabase.from('productos').update({ variantes: newVariantes }).eq('id', upd.id);
                    }
                } else {
                    await supabase.from('productos').update({ stock: upd.originalStock }).eq('id', upd.id);
                }
            }
        }
    }
}

// ================= RESEÑAS =================
async function cargarResenas() { /* (misma función que tenías) */ }

// ================= FUNCIONES AUXILIARES (modal, toast, etc.) =================
// ... (el resto de funciones: abrirNuevo, abrirEditar, guardar producto, borrar, toast, etc.) ...
// Asegúrate de mantenerlas exactamente como estaban.
