require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./mongo');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Confiar en el proxy de Render (Necesario para que el Rate Limit funcione con la IP real del usuario)
app.set('trust proxy', 1);

// --- MIDDLEWARES GLOBALES ---

const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    // Permitir si el origen está en la lista O si hay un comodín '*' configurado
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Seguridad básica contra payloads grandes
app.use(express.json({ limit: '1mb' }));

// Rate Limiting para Auth (Protección contra fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Aumentado a 100 para evitar bloqueos durante pruebas
  message: 'Demasiados intentos de inicio de sesión, por favor intente nuevamente en 15 minutos.'
});
app.use('/api/auth/', authLimiter);

// --- RUTAS ---
app.use('/api/auth', require('./routes/auth.routes.js'));
app.use('/api/orders', require('./routes/orders.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/products', require('./routes/products.routes.js'));
app.use('/api/payments', require('./routes/payments.routes.js'));

// Ruta principal
app.get('/', (req, res) => {
  res.json({ message: '¡API de ACME E-commerce funcionando correctamente!' });
});

// --- MANEJO DE ERRORES ---

// 404 - Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Error global
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado:', err.stack);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --- INICIO DEL SERVIDOR ---
// 🔌 Conectar a Mongo y LUEGO levantar el server para asegurar consistencia.
// Esto soluciona la "race condition" que mostraba la base de datos como 'undefined'.
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
    console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Base de datos activa: ${mongoose.connection.name}`);
  });
};

startServer();
