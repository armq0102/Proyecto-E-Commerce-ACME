const { Router } = require('express');
const mongoose = require('mongoose');
const verifyToken = require('../auth.middleware');
const Order = require('../Order.model');
const User = require('../User.model');
const Product = require('../Product.model');

const router = Router();

// 1. CREAR UN PEDIDO (POST /api/orders)
router.post('/', verifyToken, async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || items.length === 0) {
            return res.status(400).json({ ok: false, msg: 'El carrito no puede estar vacío' });
        }

        // VALIDACIÓN DE SEGURIDAD: Verificar que los IDs sean válidos para MongoDB
        if (items.some(item => !mongoose.isValidObjectId(item.id))) {
            return res.status(400).json({ ok: false, msg: 'Tu carrito contiene productos antiguos. Por favor, vacíalo y vuelve a agregar los productos.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
        }

        if (!user.address || user.address.trim() === '') {
            return res.status(400).json({ ok: false, msg: 'Por favor, completa tu dirección de envío en "Mi Perfil" antes de comprar.' });
        }

        const sanitizedItems = [];
        let calculatedTotal = 0;
        const productIds = items.map(item => item.id);
        const products = await Product.find({ '_id': { $in: productIds } });

        for (const item of items) {
            const product = products.find(p => p.id === item.id);
            if (!product) {
                return res.status(404).json({ ok: false, msg: `El producto '${item.title || item.id}' no existe.` });
            }

            if (product.stock < item.qty) {
                return res.status(409).json({ ok: false, msg: `Stock insuficiente para '${product.title}'. Disponibles: ${product.stock}` });
            }

            sanitizedItems.push({
                productId: product.id,
                title: product.title,
                price: product.price,
                qty: item.qty
            });

            calculatedTotal += product.price * item.qty;
        }

        const order = new Order({
            userId: user.id,
            items: sanitizedItems,
            total: calculatedTotal,
            shippingAddress: user.address,
            status: 'Pendiente',
            statusHistory: [{
                status: 'Pendiente',
                note: 'Pedido creado por el usuario'
            }]
        });
        await order.save();

        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.qty } });
        }

        res.status(201).json({ ok: true, msg: '¡Pedido realizado con éxito!', data: order });

    } catch (error) {
        console.error('❌ Error creando pedido:', error);
        res.status(500).json({ ok: false, msg: 'Error al procesar el pedido', error: error.message });
    }
});

// 2. OBTENER MIS PEDIDOS (GET /api/orders)
router.get('/', verifyToken, async (req, res) => {
    try {
        const myOrders = await Order.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.status(200).json(myOrders); // El frontend espera un array
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al obtener los pedidos', error: error.message });
    }
});

module.exports = router;