const { Router } = require('express');
const mongoose = require('mongoose');
const Product = require('../Product.model');
const Order = require('../Order.model');
const User = require('../User.model');
const verifyToken = require('../auth.middleware');

const router = Router();

// Middleware: Verificar Token y Rol de Admin
router.use(verifyToken);
router.use(async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ ok: false, msg: 'Acceso denegado. Requiere rol de administrador.' });
    }
    next();
});

// Configuración de Estados de Pedidos
const VALID_STATUSES = ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'];
const STATUS_FLOW = {
    Pendiente: ['Enviado', 'Cancelado'],
    Enviado: ['Entregado'],
    Entregado: [],
    Cancelado: []
};

// ==========================================
// RUTAS DE PRODUCTOS (Inventario)
// ==========================================

// GET /api/admin/products
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error obteniendo productos' });
    }
});

// POST /api/admin/products (Crear)
router.post('/products', async (req, res) => {
    try {
        // CORRECCIÓN: Mapear 'name' -> 'title' y 'imageUrl' -> 'img'
        const { name, price, stock, imageUrl, status } = req.body;
        
        const newProduct = new Product({
            title: name,
            price,
            stock,
            img: imageUrl,
            status: status || 'active'
        });

        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: 'Error creando producto' });
    }
});

// PUT /api/admin/products/:id (Editar - Aquí estaba el error principal)
router.put('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, stock, imageUrl, status } = req.body;

        // CORRECCIÓN: Construir objeto explícito para asegurar que 'status' entra
        // y que los nombres de campos coinciden con el Schema.
        const updateData = {
            title: name,       // Frontend envía 'name', DB usa 'title'
            price,
            stock,
            img: imageUrl,     // Frontend envía 'imageUrl', DB usa 'img'
            status             // Aseguramos que el estado se actualice
        };

        const product = await Product.findByIdAndUpdate(id, updateData, { new: true });

        if (!product) {
            return res.status(404).json({ ok: false, msg: 'Producto no encontrado' });
        }

        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: 'Error actualizando producto' });
    }
});

// ==========================================
// OTRAS RUTAS ADMIN (Soporte para admin.js)
// ==========================================

router.get('/orders', async (req, res) => {
    const orders = await Order.find().populate('userId', 'name email').populate('items.productId');
    res.json(orders);
});

// PATCH /api/admin/orders/:id/status (Actualizar estado)
router.patch('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // 1. Validaciones básicas
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ ok: false, msg: 'ID de pedido inválido' });
        }
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ ok: false, msg: `Estado inválido. Permitidos: ${VALID_STATUSES.join(', ')}` });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' });
        }

        // 2. Validar flujo de estados (Reglas de negocio)
        if (['Entregado', 'Cancelado'].includes(order.status)) {
            return res.status(409).json({ ok: false, msg: `El pedido ya está ${order.status} y no se puede modificar.` });
        }

        const allowedNext = STATUS_FLOW[order.status] || [];
        if (!allowedNext.includes(status)) {
            return res.status(409).json({ ok: false, msg: `Transición no permitida: de ${order.status} a ${status}` });
        }

        // 3. Lógica de Stock: Si se cancela, devolver productos al inventario
        if (status === 'Cancelado') {
            for (const item of order.items) {
                if (item.productId && item.qty > 0) {
                    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
                }
            }
        }

        // 4. Guardar cambio
        order.status = status;
        if (!order.statusHistory) order.statusHistory = [];
        order.statusHistory.push({ status, date: new Date(), note: 'Admin update' });
        await order.save();

        res.json({ ok: true, msg: 'Estado actualizado correctamente', order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: 'Error al actualizar el estado del pedido' });
    }
});

router.get('/users', async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users);
});

// PATCH /api/admin/users/:id/status (Suspender/Activar)
router.patch('/users/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // 1. Validaciones
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ ok: false, msg: 'ID de usuario inválido.' });
        }
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ ok: false, msg: 'Estado no válido. Solo se permite "active" o "suspended".' });
        }

        // 2. Regla de negocio: No se puede suspender al admin logueado
        if (req.user.userId === id) {
            return res.status(403).json({ ok: false, msg: 'No puedes cambiar tu propio estado.' });
        }

        // 3. Actualizar usuario
        const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });

        res.json({ ok: true, msg: `El estado del usuario ha sido actualizado.`, user });
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
    }
});

module.exports = router;