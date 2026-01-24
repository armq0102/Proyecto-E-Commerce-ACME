const { Router } = require('express');
const verifyToken = require('./auth.middleware.js');
const verifyAdmin = require('./admin.middleware.js');

// Importar sub-rutas especializadas
const adminOrdersRoutes = require('./admin.orders.routes.js');
const adminProductsRoutes = require('./admin.products.routes.js');
const adminUsersRoutes = require('./admin.users.routes.js');

const router = Router();

// --- MIDDLEWARE DE SEGURIDAD GLOBAL ---
// Todas las rutas debajo de este punto requieren ser Admin
router.use(verifyToken, verifyAdmin);

// --- DELEGACIÓN DE RUTAS ---
router.use('/orders', adminOrdersRoutes);
router.use('/products', adminProductsRoutes);
router.use('/users', adminUsersRoutes);

module.exports = router;