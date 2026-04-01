// whatsapp.js — Armar y enviar pedido por WhatsApp
import { CONFIG } from '../config.js';
import { carrito } from '../carrito.js';
import { mostrarToast } from './toast.js';

export function enviarWhatsApp(productos, onSuccess) {
    const items = carrito.itemsConDatos(productos);
    if (items.length === 0) {
        mostrarToast('⚠️ Tu carrito está vacío', 'warning');
        return;
    }

    // Agrupar por teléfono del vendedor
    const porVendedor = {};
    items.forEach(item => {
        const tel = item.telefonovendedor || CONFIG.whatsapp;
        if (!porVendedor[tel]) {
            porVendedor[tel] = { telefono: tel, vendedor: item.vendedor, items: [] };
        }
        porVendedor[tel].items.push(item);
    });

    const vendedores = Object.values(porVendedor);

    vendedores.forEach((grupo, i) => {
        const totalGrupo = grupo.items.reduce((s, it) => s + it.precio * it.cantidad, 0);
        let texto = `🛍️ *Pedido — Shopping Pilón*\n\n`;
        texto += `📦 *Productos:*\n`;
        grupo.items.forEach(item => {
            texto += `• ${item.nombre}${item.variantNombre} x${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString('es-CU')} CUP\n`;
        });
        texto += `\n💰 *Total: $${totalGrupo.toLocaleString('es-CU')} CUP*\n`;
        if (vendedores.length > 1) texto += `\n_Pedido dividido entre ${vendedores.length} vendedores._\n`;
        texto += `\nHola, me gustaría confirmar este pedido. 😊`;

        setTimeout(() => {
            window.open(`https://wa.me/${grupo.telefono}?text=${encodeURIComponent(texto)}`, '_blank');
        }, i * 800);
    });

    setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess(vendedores.length);
    }, vendedores.length * 800);
}
