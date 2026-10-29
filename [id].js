// functions/producto/[id].js
export async function onRequest(context) {
    const { id } = context.params;
    const SUPABASE_URL = 'https://xistchuskgnmjrzlntve.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpc3RjaHVza2dubWpyemxudHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQzMzIsImV4cCI6MjA5MDgyMDMzMn0.2uQXmRgJ5lQBSMTz5keUhcj9HFhSq0t78Pcpu-CmSS4';
    const YOUR_DOMAIN = 'https://granma-market.pages.dev'; 

    // 1. Obtener datos del producto
    const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${id}&select=nombre,precio,preciooferta,enoferta,imagen,vendedor,moneda`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const productos = await response.json();
    if (!productos.length) return new Response('Producto no encontrado', { status: 404 });
    
    const p = productos[0];
    const precioFinal = p.enoferta && p.preciooferta ? p.preciooferta : p.precio;
    const textoMoneda = (p.moneda === 'USD') ? 'USD' : 'CUP';

    // 2. MAGIA: Convertir la imagen (WebP/cuadrada) a JPG horizontal de 1200x630
    // Usamos un CDN de imágenes gratuito que redimensiona y cambia el formato al vuelo.
    const rawImage = p.imagen || 'https://granma-market.pages.dev/icon-512.png';
    const imagenOG = `https://images.weserv.nl/?url=${encodeURIComponent(rawImage)}&w=1200&h=630&fit=cover&output=jpg&q=80`;

    // 3. HTML minimalista SOLO para que WhatsApp lea las etiquetas
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${p.nombre} - Granma Market</title>
    <meta property="og:title" content="${p.nombre} - $${precioFinal} ${textoMoneda}" />
    <meta property="og:description" content="Vendido por ${p.vendedor} en Granma Market" />
    <meta property="og:image" content="${imagenOG}" />
    <meta property="og:image:secure_url" content="${imagenOG}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${YOUR_DOMAIN}/producto/${id}" />
    <meta property="og:type" content="product" />
    
    <!-- Redirección invisible para los bots de WhatsApp -->
    <script>
        window.location.href = "${YOUR_DOMAIN}/?producto=${id}";
    </script>
</head>
<body>
    <p>Redirigiendo a Granma Market...</p>
</body>
</html>`;

    return new Response(html, {
        headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate' // Evitar caché de bots
        }
    });
}