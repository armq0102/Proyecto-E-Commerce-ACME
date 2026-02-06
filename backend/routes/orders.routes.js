const { Router } = require('express');
const mongoose = require('mongoose');
const verifyToken = require('../auth.middleware');
const Order = require('../Order.model');
const User = require('../User.model');
const Product = require('../Product.model');
const { sendError } = require('../utils/response');

const router = Router();

// 1. CREAR UN PEDIDO (POST /api/orders)
router.post('/', verifyToken, async (req, res) => {
    return sendError(
        res,
        409,
        'Los pedidos se crean desde el flujo de pagos. Usa /api/payments/create-transaction.'
    );
});

// 2. OBTENER MIS PEDIDOS (GET /api/orders)
router.get('/', verifyToken, async (req, res) => {
    try {
        const pageParam = parseInt(req.query.page, 10);
        const limitParam = parseInt(req.query.limit, 10);
        const shouldPaginate = Number.isInteger(pageParam) || Number.isInteger(limitParam);

        if (!shouldPaginate) {
            const myOrders = await Order.find({ userId: req.user.userId }).sort({ createdAt: -1 });
            return res.status(200).json(myOrders); // El frontend espera un array
        }

        const page = Math.max(pageParam || 1, 1);
        const limit = Math.min(Math.max(limitParam || 10, 1), 50);
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            Order.find({ userId: req.user.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Order.countDocuments({ userId: req.user.userId })
        ]);

        const pages = Math.max(Math.ceil(total / limit), 1);
        return res.status(200).json({ items, page, limit, total, pages });
    } catch (error) {
        return sendError(res, 500, 'Error al obtener los pedidos', error.message);
    }
});

module.exports = router;