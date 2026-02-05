# 🛍️ ACME E-commerce Platform

Plataforma de comercio electronico completa construida con Node.js, Express y MongoDB. Incluye autenticacion JWT, pasarela de pagos con Wompi y panel de administracion.

**Stack:** Node.js, Express, MongoDB, Mongoose, JWT, bcrypt

---

## ✨ Caracteristicas principales

### 🔐 Autenticacion y autorizacion
- Registro e inicio de sesion de usuarios
- Autenticacion basada en JWT
- Roles de usuario (user/admin)
- Proteccion contra fuerza bruta con rate limiting
- Cuentas con estado activo/suspendido

### 🛒 Funcionalidades de usuario
- Catalogo de productos sincronizado con el backend
- Carrito persistente en el navegador
- Perfil de usuario y direccion de envio
- Historial de pedidos

### 💳 Sistema de pagos
- Integracion con Wompi (Colombia)
- Firmas de integridad (SHA-256) y validacion de webhooks
- Creacion de orden antes del pago
- Manejo de stock con transaccion en el webhook

### 👨‍💼 Panel de administracion
- CRUD de productos
- Control de inventario y estados de producto
- Gestion de pedidos y cambios de estado
- Gestion de usuarios (activar/suspender)

### 🔒 Seguridad
- Contrasenas hasheadas con bcrypt
- Validacion de datos en rutas criticas
- CORS con lista blanca
- Limite de payload en JSON

---

## 🚀 Tecnologias utilizadas

**Backend**
- Node.js
- Express.js
- MongoDB + Mongoose
- JWT + bcrypt
- express-rate-limit

**Frontend**
- HTML, CSS, JavaScript (vanilla)

**Pagos**
- Wompi API
- crypto (SHA-256)

**Almacenamiento**
- Cloudinary (imágenes de productos)

---

## 🏗️ Arquitectura de producción

```
┌─────────────────────────────────────────────────┐
│  Frontend (Render)                              │
│  acme-1zib.onrender.com                         │
│  • HTML/CSS/JS estáticos                        │
│  • Panel de administración                      │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Backend API (Render)                           │
│  proyecto-e-commerce-acme.onrender.com        │
│  • Node.js + Express                            │
│  • Autenticación JWT                            │
│  • Lógica de negocio                            │
└───┬─────────────────────┬───────────────────┬───┘
    │                     │                   │
    ▼                     ▼                   ▼
┌─────────┐      ┌──────────────┐    ┌─────────────┐
│ MongoDB │      │  Cloudinary  │    │   Wompi     │
│  Atlas  │      │  (Imágenes)  │    │  (Pagos)    │
└─────────┘      └──────────────┘    └─────────────┘
```

**Ventajas de esta arquitectura:**
- ✅ Imágenes permanentes (no se pierden en reinicios de Render)
- ✅ Base de datos escalable en la nube
- ✅ Despliegue automático con Git push
- ✅ Separación de responsabilidades
- ✅ Lista para producción real

---

## 📋 Requisitos previos
- Node.js >= 18
- MongoDB >= 7 o cuenta en MongoDB Atlas
- npm

---

## 🔧 Instalacion rapida

1) Clonar repositorio
```bash
git clone https://github.com/armq0102/Proyecto-E-Commerce-ACME.git
cd Proyecto-E-Commerce-ACME
```

2) Instalar dependencias
```bash
cd backend
npm install
```

3) Configurar variables de entorno
```bash
cp .env.example .env
```

4) Sembrar datos de prueba
```bash
npm run seed
```

5) Iniciar servidor
```bash
npm run dev   # desarrollo
npm start     # produccion
```

Servidor disponible en `http://localhost:3000`.

---

## ⚙️ Variables de entorno

```bash
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb+srv://...
JWT_SECRET=tu_secreto
FRONTEND_URL=https://tu-frontend.com

# Wompi (Pagos)
WOMPI_PUBLIC_KEY=...
WOMPI_INTEGRITY_SECRET=...
WOMPI_PUBLIC_KEY_TEST=...
WOMPI_INTEGRITY_SECRET_TEST=...

# Cloudinary (Almacenamiento de imágenes)
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

**Nota:** Las imágenes de productos se suben automáticamente a Cloudinary desde el panel de administración. No es necesario guardar archivos localmente en el servidor.

---

## 🔑 Endpoints principales

**Auth**
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- PUT `/api/auth/update`

**Productos**
- GET `/api/products`

**Pedidos**
- POST `/api/orders`
- GET `/api/orders`

**Pagos**
- POST `/api/payments/create-transaction`
- POST `/api/payments/webhook`

**Admin**
- GET `/api/admin/products`
- POST `/api/admin/products`
- PUT `/api/admin/products/:id`
- GET `/api/admin/orders`
- PATCH `/api/admin/orders/:id/status`
- GET `/api/admin/users`
- PATCH `/api/admin/users/:id/status`

---

## 🧭 Flujo de compra (resumen)
1. Usuario agrega productos al carrito
2. Frontend crea transaccion: `POST /api/payments/create-transaction`
3. Backend crea orden en estado **Pendiente**
4. Usuario paga en Wompi
5. Wompi envia webhook: `POST /api/payments/webhook`
6. Backend valida firma, descuenta stock y actualiza el pedido

---

## 🌍 Despliegue

**Servicios utilizados:**
- **Backend:** Render (https://proyecto-e-commerce-acme.onrender.com)
- **Frontend:** Render (https://acme-1zib.onrender.com)
- **Base de datos:** MongoDB Atlas
- **Almacenamiento de imágenes:** Cloudinary
- **Pagos:** Wompi

**Configuración en Render:**
1. Conectar repositorio de GitHub
2. Configurar variables de entorno (ver sección anterior)
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Auto-deploy habilitado (cada push a main despliega automáticamente)

**Importante:** 
- No es necesario correr el servidor localmente para desarrollo
- Edita código → git push → Render redespliega automáticamente
- Las imágenes se guardan en Cloudinary (permanentes)

---

## 📄 Licencia
MIT

---

**ACME E-commerce Platform**
Proyecto universitario con enfoque profesional • 2026
Desarrollado por: Maria Ramirez
