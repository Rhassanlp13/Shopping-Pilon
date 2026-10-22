// functions/producto/[id].js
export async function onRequest(context) {
    const { id } = context.params;
    const SUPABASE_URL = 'https://xistchuskgnmjrzlntve.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpc3RjaHVza2dubWpyemxudHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQzMzIsImV4cCI6MjA5MDgyMDMzMn0.2uQXmRgJ5lQBSMTz5keUhcj9HFhSq0t78Pcpu-CmSS4';
    // Aseguramos que el dominio sea el nuevo
    const YOUR_DOMAIN = 'https://granma-market.pages.dev'; 

    // Incluir el campo moneda y la galería
    const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${id}&select=nombre,precio,preciooferta,enoferta,imagen,vendedor,moneda,galeria`, {
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

    // Extraer la primera imagen de la galería si la principal está vacía
    const imagenOG = p.imagen || (p.galeria && p.galeria[0]) || 'https://placehold.co/600x600?text=Sin+imagen';

    // Generar el HTML con etiquetas Open Graph correctas
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${p.nombre} - Granma Market</title>
    
    <!-- Etiquetas Open Graph para WhatsApp, Facebook, Telegram -->
    <meta property="og:title" content="${p.nombre} - $${precioFinal} ${textoMoneda}" />
    <meta property="og:description" content="Vendido por ${p.vendedor} en Granma Market" />
    <meta property="og:image" content="${imagenOG}" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta property="og:url" content="${YOUR_DOMAIN}/producto/${id}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Granma Market" />
    
    <!-- Etiquetas Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${imagenOG}" />

    <!-- Redirigir al usuario a la app real una vez que WhatsApp lea esto -->
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