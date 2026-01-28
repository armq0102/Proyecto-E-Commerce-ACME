const { Router } = require('express');
const router = Router();
const verifyToken = require('../auth.middleware');
const paymentController = require('../controllers/payment.controller');
const webhookController = require('../controllers/webhook.controller');

// ==========================================
// RUTAS DE PAGOS (WOMPI)
// ==========================================

/**
 * @route   POST /api/payments/create-transaction
 * @desc    Genera URL de pago Wompi
 * @access  Private (Requiere login)
 */
router.post('/create-transaction', verifyToken, paymentController.createWompiTransaction);

// Webhook público para Wompi
router.post('/webhook', webhookController.handleWompiWebhook);

module.exports = router;