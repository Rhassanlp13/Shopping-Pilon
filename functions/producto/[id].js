// functions/producto/[id].js
export async function onRequest(context) {
    const { id } = context.params;
    const SUPABASE_URL = 'https://xistchuskgnmjrzlntve.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpc3RjaHVza2dubWpyemxudHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQzMzIsImV4cCI6MjA5MDgyMDMzMn0.2uQXmRgJ5lQBSMTz5keUhcj9HFhSq0t78Pcpu-CmSS4';
    const YOUR_DOMAIN = 'https://granma-market.pages.dev'; 

    const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${id}&select=nombre,precio,preciooferta,enoferta,imagen,vendedor,moneda`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    
    const productos = await response.json();
    if (!productos.length) {
        return new Response('Producto no encontrado', { status: 404 });
    }
    
    const p = productos[0];
    const precioFinal = p.enoferta && p.preciooferta ? p.preciooferta : p.precio;
    const moneda = p.moneda || 'CUP';
    const textoMoneda = moneda === 'USD' ? 'USD' : 'CUP';

    // Usamos la imagen del producto. Si no hay, un placeholder.
    const imagenOG = p.imagen || 'https://placehold.co/600x600?text=Sin+imagen';

    // HTML mínimo, solo para que WhatsApp lea las etiquetas y luego redirija al usuario
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${p.nombre} - Granma Market</title>
    
    <!-- Etiquetas Open Graph (Lo que lee WhatsApp) -->
    <meta property="og:title" content="${p.nombre} - $${precioFinal} ${textoMoneda}" />
    <meta property="og:description" content="Vendido por ${p.vendedor} en Granma Market" />
    <meta property="og:image" content="${imagenOG}" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta property="og:url" content="${YOUR_DOMAIN}/producto/${id}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Granma Market" />
    
    <!-- Redirige al usuario a la app real -->
    <meta http-equiv="refresh" content="0;url=${YOUR_DOMAIN}/?producto=${id}" />
</head>
<body>
    <p>Redirigiendo a Granma Market...</p>
</body>
</html>`;

    return new Response(html, {
        headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600' 
        }
    });
}