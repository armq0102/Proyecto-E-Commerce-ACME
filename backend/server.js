require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./database/mongo');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES GLOBALES ---

// 🔌 Conectar a Mongo ANTES de levantar el server
connectDB();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  optionsSuccessStatus: 200
}));

// Seguridad básica contra payloads grandes
app.use(express.json({ limit: '1mb' }));

// --- RUTAS ---
app.use('/api/auth', require('./routes/auth.routes.js'));
app.use('/api/orders', require('./routes/orders.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/products', require('./routes/products.routes.js'));

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
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
