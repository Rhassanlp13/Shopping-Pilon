# Shopping Pilón 🛍️

Tienda online multi-vendedor para Pilón. PWA (Progressive Web App) construida con Vanilla JS y Supabase.

## Estructura

```
/
├── index.html          # Tienda pública
├── admin.html          # Panel del vendedor
├── confirmar.html      # Confirmación de pedidos
├── vender.html         # Landing para vendedores
├── style.css
├── sw.js               # Service Worker (PWA)
├── manifest.json
└── js/
    ├── app.js          # Punto de entrada
    ├── ui.js           # Fachada de UI
    ├── carrito.js      # Lógica del carrito
    ├── productos.js    # Carga y caché de productos
    ├── supabase.js     # Cliente de Supabase
    ├── config.js       # Configuración (WhatsApp, Supabase keys)
    ├── admin.js        # Lógica del panel admin
    ├── confirmar.js    # Lógica de confirmación
    └── modules/
        ├── toast.js        # Notificaciones
        ├── lightbox.js     # Zoom de imágenes
        ├── whatsapp.js     # Envío de pedidos por WhatsApp
        ├── productos-ui.js # Render del grid de productos
        ├── cart-ui.js      # Modal del carrito
        ├── detalle-ui.js   # Modal de detalle + variantes
        └── resenas-ui.js   # Reseñas de productos
```

## Configuración

Edita `js/config.js` con tus credenciales:

```js
export const CONFIG = {
    whatsapp: 'TU_NUMERO',
    supabaseUrl: 'TU_URL',
    supabaseAnonKey: 'TU_KEY'
};
```

## Base de datos (Supabase)

Tablas necesarias:
- `productos` — catálogo con soporte de variantes y ofertas
- `pedidos` — pedidos de clientes
- `reseñas` — reseñas de productos
- `vendedores_aprobados` — control de acceso por roles (`admin` / `vendedor`)

RLS activado en todas las tablas. Ver política de seguridad en `/sql/`.

## Tecnologías

- Vanilla JS (ES Modules, sin bundler)
- Supabase (PostgreSQL + Auth + RLS)
- PWA (Service Worker + Web App Manifest)
- Font Awesome, Google Fonts
