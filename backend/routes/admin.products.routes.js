const { Router } = require('express');
const mongoose = require('mongoose');
const Product = require('../Product.model');

const router = Router();

const VALID_STATUS = ['active', 'hidden', 'out_of_stock'];

// GET: Listar todos (Admin ve todo)
router.get('/', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        console.error('[ADMIN_PRODUCTS_GET]', error);
        res.status(500).json({ msg: 'Error al obtener productos' });
    }
});

// POST: Crear producto
router.post('/', async (req, res) => {
    try {
        const { name, price, stock, imageUrl, status = 'active' } = req.body;

        if (!name || price == null || stock == null) {
            return res.status(400).json({ msg: 'Faltan campos obligatorios' });
        }

        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({ msg: 'Precio inválido' });
        }

        if (!Number.isInteger(stock) || stock < 0) {
            return res.status(400).json({ msg: 'Stock inválido' });
        }

        if (!VALID_STATUS.includes(status)) {
            return res.status(400).json({ msg: 'Estado inválido' });
        }

        const newProduct = new Product({
            title: name,
            price,
            stock,
            img: imageUrl,
            status
        });

        await newProduct.save();
        res.status(201).json(newProduct);

    } catch (error) {
        console.error('[ADMIN_PRODUCTS_POST]', error);
        res.status(500).json({ msg: 'Error al crear producto' });
    }
});

// PUT: Editar producto
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ msg: 'ID inválido' });
        }

        const { name, price, stock, imageUrl, status } = req.body;

        const updateData = {};

        if (name) updateData.title = name;
        if (price != null) {
            if (typeof price !== 'number' || price < 0) {
                return res.status(400).json({ msg: 'Precio inválido' });
            }
            updateData.price = price;
        }

        if (stock != null) {
            if (!Number.isInteger(stock) || stock < 0) {
                return res.status(400).json({ msg: 'Stock inválido' });
            }
            updateData.stock = stock;
        }

        if (imageUrl) updateData.img = imageUrl;

        if (status) {
            if (!VALID_STATUS.includes(status)) {
                return res.status(400).json({ msg: 'Estado inválido' });
            }
            updateData.status = status;
        }

        const updated = await Product.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ msg: 'Producto no encontrado' });
        }

        res.json(updated);

    } catch (error) {
        console.error('[ADMIN_PRODUCTS_PUT]', error);
        res.status(500).json({ msg: 'Error al actualizar producto' });
    }
});

module.exports = router;
