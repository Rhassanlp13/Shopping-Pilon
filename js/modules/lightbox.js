// lightbox.js — Zoom de imagen
export function abrirLightbox(imgSrc) {
    if (!imgSrc) return;

    let overlay = document.getElementById('lightbox-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lightbox-overlay';
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = `
            <span class="lightbox-close">&times;</span>
            <img class="lightbox-img" src="">
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
                cerrarLightbox();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                cerrarLightbox();
            }
        });
    }

    overlay.querySelector('.lightbox-img').src = imgSrc;
    overlay.classList.add('active');
}

export function cerrarLightbox() {
    const overlay = document.getElementById('lightbox-overlay');
    if (overlay) overlay.classList.remove('active');
}
