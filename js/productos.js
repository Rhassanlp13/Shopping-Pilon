import { supabase } from './supabase.js';

export function mostrarSkeleton(grid, cantidad = 6) {
    grid.innerHTML = Array.from({ length: cantidad }, () => `
        <article class="product-card skeleton">
            <div class="skeleton-img"></div>
            <div class="product-info">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-btn"></div>
            </div>
        </article>
    `).join('');
}

export async function cargarProductos() {
    // Intentar cargar desde caché (válido por 5 minutos)
    const cached = localStorage.getItem('productos_cache');
    const timestamp = localStorage.getItem('productos_cache_time');
    if (cached && timestamp && (Date.now() - timestamp) < 4 * 60 * 1000) {
        return { ok: true, data: JSON.parse(cached) };
    }

    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        // Guardar en caché
        localStorage.setItem('productos_cache', JSON.stringify(data));
        localStorage.setItem('productos_cache_time', Date.now());

        return { ok: true, data };
    } catch (err) {
        console.error('[productos] Error al cargar:', err);
        return { ok: false, data: [] };
    }
}

