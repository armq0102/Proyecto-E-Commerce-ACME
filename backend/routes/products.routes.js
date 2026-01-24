const { Router } = require('express');
const Product = require('../Product.model');

const router = Router();

// GET /api/products - Public endpoint for product synchronization
router.get('/', async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).json(products); // Devuelve un array directo por compatibilidad con script.js
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al obtener los productos', error: error.message });
    }
});

module.exports = router;