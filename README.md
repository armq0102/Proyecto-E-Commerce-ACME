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

---

## 📋 Requisitos previos
- Node.js >= 18
- MongoDB >= 7 o cuenta en MongoDB Atlas
- npm

---

## 🔧 Instalacion rapida

1) Clonar repositorio
```bash
git clone https://github.com/tu-usuario/acme-ecommerce.git
cd acme-ecommerce
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

# Wompi
WOMPI_PUBLIC_KEY=...
WOMPI_INTEGRITY_SECRET=...
WOMPI_PUBLIC_KEY_TEST=...
WOMPI_INTEGRITY_SECRET_TEST=...
```

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
- Backend: Render / Railway / Vercel / Heroku
- Base de datos: MongoDB Atlas
- Secretos: variables de entorno en la plataforma

---

## 📄 Licencia
MIT

---

**ACME E-commerce Platform**
Proyecto universitario con enfoque profesional • 2026
Desarrollado por: Maria Ramirez
