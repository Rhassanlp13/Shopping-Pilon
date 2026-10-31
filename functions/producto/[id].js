export async function onRequest(context) {
    const { id } = context.params;
    const SUPABASE_URL = 'https://xistchuskgnmjrzlntve.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpc3RjaHVza2dubWpyemxudHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQzMzIsImV4cCI6MjA5MDgyMDMzMn0.2uQXmRgJ5lQBSMTz5keUhcj9HFhSq0t78Pcpu-CmSS4';
    const YOUR_DOMAIN = 'https://granma-market.pages.dev';

    try {
        // 1. Buscar producto en Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${id}&select=nombre,precio,preciooferta,enoferta,imagen,vendedor,moneda`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        
        const productos = await response.json();
        
        // Si el producto no existe, devolvemos el index pero con etiquetas básicas
        if (!productos || productos.length === 0) {
            return Response.redirect(`${YOUR_DOMAIN}/`, 302);
        }

        const p = productos[0];
        const precioFinal = p.enoferta && p.preciooferta ? p.preciooferta : p.precio;
        const textoMoneda = (p.moneda === 'USD') ? 'USD' : 'CUP';

        // 2. Generar imagen optimizada (JPG cuadrado de 800x800 para WhatsApp)
        // Si la imagen falla, usamos el logo de la tienda
        const rawImage = p.imagen || `${YOUR_DOMAIN}/icon-512.png`;
        const imagenOG = `https://images.weserv.nl/?url=${encodeURIComponent(rawImage)}&w=800&h=800&fit=cover&output=jpg&q=75`;

        // 3. Crear el HTML con las etiquetas Open Graph
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${p.nombre} - Granma Market</title>
    
    <!-- Etiquetas para WhatsApp y Redes Sociales -->
    <meta property="og:title" content="${p.nombre}" />
    <meta property="og:description" content="💰 $${precioFinal} ${textoMoneda} | Vendido por ${p.vendedor}" />
    <meta property="og:image" content="${imagenOG}" />
    <meta property="og:image:secure_url" content="${imagenOG}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta property="og:url" content="${YOUR_DOMAIN}/producto/${id}" />
    <meta property="og:type" content="product" />

    <!-- Redirección para humanos (los bots leen el og:image y luego ignoran esto) -->
    <meta http-equiv="refresh" content="0; url=${YOUR_DOMAIN}/?producto=${id}">
    <script>window.location.href = "${YOUR_DOMAIN}/?producto=${id}";</script>
</head>
<body>
    <p>Redirigiendo a Granma Market...</p>
</body>
</html>`;

        // 4. Devolver la respuesta SIN CACHÉ para que WhatsApp siempre lea lo último
        return new Response(html, {
            headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error) {
        // Si hay un error grave, mandamos al index
        return Response.redirect(`${YOUR_DOMAIN}/`, 302);
    }
}