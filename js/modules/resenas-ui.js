// resenas-ui.js — Carga y envío de reseñas
import { supabase } from '../supabase.js';
import { mostrarToast } from './toast.js';

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const resenasUI = {
    estrellaSeleccionada: 0,
    productoActualId: null,

    async cargar(productoId) {
        this.productoActualId = productoId;
        const lista  = document.getElementById('resenas-lista');
        const count  = document.getElementById('resenas-count');
        if (!lista) return;

        lista.innerHTML = '<div class="resenas-empty"><i class="fas fa-spinner fa-spin"></i></div>';

        try {
            const { data, error } = await supabase
                .from('reseñas')
                .select('*')
                .eq('productoId', productoId)
                .order('fecha', { ascending: false });
            if (error) throw error;

            count.textContent = data.length > 0 ? `(${data.length})` : '';

            if (data.length === 0) {
                lista.innerHTML = '<div class="resenas-empty"><i class="fas fa-comment-slash"></i><br>Sin reseñas aún. ¡Sé el primero!</div>';
                return;
            }

            lista.innerHTML = data.map(r => `
                <div class="resena-item">
                    <div class="resena-header">
                        <span class="resena-autor">${esc(r.nombre)}</span>
                        <span class="resena-estrellas">${'★'.repeat(Number(r.estrellas))}${'☆'.repeat(5 - Number(r.estrellas))}</span>
                    </div>
                    <div class="resena-texto">${esc(r.texto)}</div>
                    <div class="resena-fecha">${new Date(r.fecha).toLocaleDateString('es-CU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>`).join('');
        } catch (err) {
            console.error('[resenas] Error al cargar:', err);
            lista.innerHTML = '<div class="resenas-empty">No se pudieron cargar las reseñas.</div>';
        }
    },

    async enviar() {
        const nombre   = document.getElementById('resena-nombre').value.trim();
        const texto    = document.getElementById('resena-texto').value.trim();
        const estrellas = this.estrellaSeleccionada;

        if (!nombre || !texto || estrellas === 0) {
            mostrarToast('⚠️ Completa nombre, estrellas y opinión', 'warning');
            return;
        }

        const btn = document.getElementById('btn-enviar-resena');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';

        try {
            const { error } = await supabase
                .from('reseñas')
                .insert([{
                    productoId: this.productoActualId,
                    nombre: nombre.slice(0, 30),
                    texto: texto.slice(0, 200),
                    estrellas: Math.min(5, Math.max(1, estrellas)),
                    fecha: new Date().toISOString(),
                }]);
            if (error) throw error;

            mostrarToast('✅ Reseña publicada', 'ok');
            document.getElementById('resena-nombre').value = '';
            document.getElementById('resena-texto').value  = '';
            this.estrellaSeleccionada = 0;
            this.actualizarEstrellas(0);
            await this.cargar(this.productoActualId);
        } catch (err) {
            console.error('[resenas] Error al enviar:', err);
            mostrarToast('❌ Error al publicar reseña', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar reseña';
        }
    },

    actualizarEstrellas(valor) {
        document.querySelectorAll('#estrellas-input i').forEach((star, i) => {
            star.classList.toggle('activa', i < valor);
        });
    },

    bindEventos() {
        document.querySelectorAll('#estrellas-input i').forEach(star => {
            star.addEventListener('click', () => {
                this.estrellaSeleccionada = parseInt(star.dataset.val);
                this.actualizarEstrellas(this.estrellaSeleccionada);
            });
            star.addEventListener('mouseover', () => this.actualizarEstrellas(parseInt(star.dataset.val)));
            star.addEventListener('mouseout',  () => this.actualizarEstrellas(this.estrellaSeleccionada));
        });

        document.getElementById('btn-enviar-resena')?.addEventListener('click', () => this.enviar());
    },

    reset() {
        document.getElementById('resena-nombre').value = '';
        document.getElementById('resena-texto').value  = '';
        this.estrellaSeleccionada = 0;
        this.actualizarEstrellas(0);
    },
};
