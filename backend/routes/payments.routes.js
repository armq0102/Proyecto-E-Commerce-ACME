const { Router } = require('express');
const verifyToken = require('../auth.middleware');
const { createTransaction, handleWebhook } = require('../controllers/payment.controller');
const { z, validate } = require('../utils/validate');

const router = Router();

const createTransactionSchema = z.object({
	items: z.array(z.object({
		_id: z.string().optional(),
		id: z.string().optional(),
		qty: z.number().int().positive()
	}).refine((item) => !!(item._id || item.id), {
		message: 'Cada item debe tener un id valido.'
	})).min(1, 'El carrito esta vacio.')
});

router.post('/create-transaction', verifyToken, validate(createTransactionSchema), createTransaction);
router.post('/webhook', handleWebhook);

module.exports = router;