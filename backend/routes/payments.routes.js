const { Router } = require('express');
const verifyToken = require('../auth.middleware');
const { createTransaction, handleWebhook } = require('../controllers/payment.controller');

const router = Router();

router.post('/create-transaction', verifyToken, createTransaction);
router.post('/webhook', handleWebhook);

module.exports = router;