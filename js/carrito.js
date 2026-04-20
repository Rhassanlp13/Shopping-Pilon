// carrito.js — Corregido: validación de variante y stock + guardia
export const carrito = {
    _items: [],

    init() {
        try {
            const guardado = localStorage.getItem('pilon_cart');
            this._items = guardado ? JSON.parse(guardado) : [];
        } catch {
            this._items = [];
        }
    },

    _guardar() {
        try {
            localStorage.setItem('pilon_cart', JSON.stringify(this._items));
        } catch (e) {
            console.error('[carrito] No se pudo guardar:', e);
        }
    },

    itemsConDatos(productos) {
        // ✅ Guardia contra productos nulo o no array
        if (!productos || !Array.isArray(productos)) {
            console.warn('[carrito] productos no disponible');
            return [];
        }
        return this._items
            .map(item => {
                const p = productos.find(p => p.id === item.id);
                if (!p) return null;
                let variante = null;
                if (item.variantId !== undefined && item.variantId !== null) {
                    if (p.variantes && p.variantes[item.variantId]) {
                        variante = p.variantes[item.variantId];
                    } else {
                        return null;
                    }
                }
                const precio = variante
                    ? variante.precio
                    : (p.enoferta && p.preciooferta ? p.preciooferta : p.precio);
                const nombreVariante = variante ? ` (${variante.nombre})` : '';
                const stockDisponible = variante ? variante.stock : p.stock;
                return {
                    ...p,
                    precio,
                    cantidad: item.cantidad,
                    variantId: item.variantId,
                    variantNombre: nombreVariante,
                    stockDisponible,
                    seller_id: p.seller_id,
                };
            })
            .filter(Boolean);
    },

    agregar(idProducto, variantId, productos) {
        const producto = productos.find(p => p.id === idProducto);
        if (!producto) return { ok: false, msg: 'Producto no encontrado' };

        let variante = null;
        if (variantId !== null && variantId !== undefined) {
            if (!producto.variantes || !producto.variantes[variantId]) {
                return { ok: false, msg: 'Variante no válida' };
            }
            variante = producto.variantes[variantId];
        }
        const stock = variante ? variante.stock : producto.stock;
        if (stock <= 0) return { ok: false, msg: 'Producto agotado' };

        const existente = this._items.find(i => i.id === idProducto && i.variantId === variantId);
        if (existente) {
            if (existente.cantidad >= stock) {
                return { ok: false, msg: `Solo hay ${stock} disponibles` };
            }
            existente.cantidad++;
        } else {
            this._items.push({ id: idProducto, variantId, cantidad: 1 });
        }
        this._guardar();

        const nombreProducto = variante ? `${producto.nombre} (${variante.nombre})` : producto.nombre;
        return { ok: true, msg: `${nombreProducto} añadido al carrito` };
    },

    aumentar(idProducto, variantId, productos) {
        const item = this._items.find(i => i.id === idProducto && i.variantId === variantId);
        const producto = productos.find(p => p.id === idProducto);
        if (!item || !producto) return;

        let variante = null;
        if (variantId !== null && variantId !== undefined) {
            if (!producto.variantes || !producto.variantes[variantId]) return;
            variante = producto.variantes[variantId];
        }
        const stock = variante ? variante.stock : producto.stock;

        if (item.cantidad < stock) {
            item.cantidad++;
            this._guardar();
        }
    },

    disminuir(idProducto, variantId) {
        const index = this._items.findIndex(i => i.id === idProducto && i.variantId === variantId);
        if (index === -1) return;
        if (this._items[index].cantidad > 1) {
            this._items[index].cantidad--;
        } else {
            this._items.splice(index, 1);
        }
        this._guardar();
    },

    vaciar() {
        this._items = [];
        this._guardar();
    },

    cantidadDe(idProducto, variantId) {
        return this._items.find(i => i.id === idProducto && i.variantId === variantId)?.cantidad ?? 0;
    },

    total(productos) {
        return this._items.reduce((sum, item) => {
            const p = productos.find(p => p.id === item.id);
            if (!p) return sum;
            let variante = null;
            if (item.variantId !== null && item.variantId !== undefined) {
                if (p.variantes && p.variantes[item.variantId]) {
                    variante = p.variantes[item.variantId];
                } else {
                    return sum;
                }
            }
            const precio = variante
                ? variante.precio
                : (p.enoferta && p.preciooferta ? p.preciooferta : p.precio);
            return sum + precio * item.cantidad;
        }, 0);
    },

    get cantidad() {
        return this._items.reduce((sum, i) => sum + i.cantidad, 0);
    },
};