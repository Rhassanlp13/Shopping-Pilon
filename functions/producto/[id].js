// functions/producto/[id].js
export async function onRequest(context) {
    const { id } = context.params;
    const SUPABASE_URL = 'https://xistchuskgnmjrzlntve.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpc3RjaHVza2dubWpyemxudHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQzMzIsImV4cCI6MjA5MDgyMDMzMn0.2uQXmRgJ5lQBSMTz5keUhcj9HFhSq0t78Pcpu-CmSS4';

    const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${id}&select=nombre,precio,preciooferta,enoferta,imagen,vendedor`, {
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
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${p.nombre} - Shopping Pilón</title>
    <meta property="og:title" content="${p.nombre} - $${precioFinal} CUP" />
    <meta property="og:description" content="Vendido por ${p.vendedor}" />
    <meta property="og:image" content="${p.imagen}" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta property="og:url" content="https://shopping-pilon.pages.dev/producto/${id}" />
    <meta property="og:type" content="product" />
    <meta http-equiv="refresh" content="0;url=/?producto=${id}" />
</head>
<body>
    <p>Redirigiendo a la tienda...</p>
</body>
</html>`;
    return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
    });
}