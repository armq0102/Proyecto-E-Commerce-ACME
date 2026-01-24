const { Router } = require('express');
const verifyToken = require('../auth.middleware');
const verifyAdmin = require('../admin.middleware');

const router = Router();

// Middleware de seguridad para todas las rutas de admin
router.use(verifyToken, verifyAdmin);

router.use('/products', require('./admin.products.routes'));
router.use('/orders', require('./admin.orders.routes'));
router.use('/users', require('./admin.users.routes'));

module.exports = router;