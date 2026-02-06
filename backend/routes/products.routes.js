const { Router } = require('express');
const Product = require('../Product.model');
const { sendError } = require('../utils/response');

const router = Router();

// GET /api/products - Public endpoint for product synchronization
router.get('/', async (req, res) => {
    try {
        const pageParam = parseInt(req.query.page, 10);
        const limitParam = parseInt(req.query.limit, 10);
        const shouldPaginate = Number.isInteger(pageParam) || Number.isInteger(limitParam);

        if (!shouldPaginate) {
            const products = await Product.find({});
            return res.status(200).json(products); // Mantener compatibilidad con script.js
        }

        const page = Math.max(pageParam || 1, 1);
        const limit = Math.min(Math.max(limitParam || 10, 1), 100);
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            Product.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Product.countDocuments()
        ]);

        const pages = Math.max(Math.ceil(total / limit), 1);
        return res.status(200).json({ items, page, limit, total, pages });
    } catch (error) {
        return sendError(res, 500, 'Error al obtener los productos', error.message);
    }
});

module.exports = router;