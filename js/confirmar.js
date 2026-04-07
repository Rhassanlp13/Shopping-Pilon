import { supabase } from './supabase.js';
import { escapeHtml } from './utils/escape.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(location.search);
    const pedidoId = urlParams.get('pedido');
    const loadingDiv = document.getElementById('loading');
    const pedidoInfoDiv = document.getElementById('pedido-info');
    const confirmarBtn = document.getElementById('btn-confirmar');
    const mensajeDiv = document.getElementById('mensaje');
    if (!pedidoId) {
        loadingDiv.style.display = 'none';
        pedidoInfoDiv.style.display = 'block';
        pedidoInfoDiv.innerHTML = '<p style="color:red;">Error: No se especificó un pedido.</p>';
        return;
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        loadingDiv.style.display = 'none';
        pedidoInfoDiv.style.display = 'block';
        pedidoInfoDiv.innerHTML = '<p style="color:red;">Debes iniciar sesión para confirmar este pedido.</p>';
        return;
    }
    const userId = session.user.id;
    try {
        const { data: p, error } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
        if (error) throw error;
        if (!p) throw new Error('Pedido no encontrado.');
        if (p.vendedor_id !== userId) throw new Error('No tienes permiso para ver este pedido.');
        loadingDiv.style.display = 'none';
        pedidoInfoDiv.style.display = 'block';
        let productosHtml = '<div class="productos"><h3>Productos:</h3>';
        p.productos.forEach(prod => { productosHtml += `<div class="producto-item"><span>${escapeHtml(prod.nombre)} x${prod.cantidad}</span><span>$${(prod.precio * prod.cantidad).toLocaleString('es-CU')}</span></div>`; });
        productosHtml += `</div><div class="total">Total: $${p.total.toLocaleString('es-CU')}</div>`;
        pedidoInfoDiv.innerHTML = `<div class="pedido-info"><p><strong>Cliente:</strong> ${escapeHtml(p.cliente_nombre)}</p><p><strong>Teléfono:</strong> ${escapeHtml(p.cliente_telefono)}</p><p><strong>Fecha:</strong> ${new Date(p.created_at).toLocaleString()}</p>${productosHtml}</div>`;
        if (p.status === 'pendiente') {
            confirmarBtn.style.display = 'block';
            confirmarBtn.onclick = async () => {
                confirmarBtn.disabled = true;
                confirmarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmando...';
                try {
                    const res = await supabase.rpc('confirmar_pedido', { pedido_id: pedidoId });
                    if (res.error) throw res.error;
                    if (res.data && res.data.success) {
                        mensajeDiv.innerHTML = '<i class="fas fa-check-circle"></i> Pedido confirmado. ¡Stock actualizado!';
                        mensajeDiv.classList.add('success');
                        confirmarBtn.style.display = 'none';
                    } else {
                        throw new Error(res.data?.error || 'Error al confirmar');
                    }
                } catch (err) {
                    mensajeDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${err.message}`;
                    mensajeDiv.classList.add('error');
                    confirmarBtn.disabled = false;
                    confirmarBtn.innerHTML = 'Confirmar Pedido';
                }
            };
        } else {
            mensajeDiv.innerHTML = '<i class="fas fa-check-circle"></i> Este pedido ya fue confirmado.';
            mensajeDiv.classList.add('success');
        }
    } catch (err) {
        loadingDiv.style.display = 'none';
        pedidoInfoDiv.style.display = 'block';
        pedidoInfoDiv.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
});
