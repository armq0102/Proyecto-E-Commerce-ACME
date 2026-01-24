const { Router } = require('express');
const mongoose = require('mongoose');
const Order = require('../Order.model');
const Product = require('../Product.model');

const router = Router();

// Estados válidos del negocio
const VALID_STATUSES = ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'];

// Flujo permitido (máquina de estados)
const STATUS_FLOW = {
    Pendiente: ['Enviado', 'Cancelado'],
    Enviado: ['Entregado'],
    Entregado: [],
    Cancelado: []
};

// ==========================================
// GET /api/admin/orders
// Listar todos los pedidos (Admin)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error('[ADMIN_ORDERS_GET]', error);
        res.status(500).json({ ok: false, msg: 'Error al obtener pedidos' });
    }
});

// ==========================================
// PATCH /api/admin/orders/:id/status
// Actualizar estado del pedido (Admin)
// ==========================================
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validar ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ ok: false, msg: 'ID de pedido inválido' });
        }

        // Validar estado
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                ok: false,
                msg: `Estado inválido. Permitidos: ${VALID_STATUSES.join(', ')}`
            });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' });
        }

        // Regla: pedidos finalizados no se tocan
        if (['Entregado', 'Cancelado'].includes(order.status)) {
            return res.status(409).json({
                ok: false,
                msg: `No se puede modificar un pedido ${order.status}`
            });
        }

        // Validar transición de estado
        const allowedNext = STATUS_FLOW[order.status];
        if (!allowedNext.includes(status)) {
            return res.status(409).json({
                ok: false,
                msg: `Transición inválida: ${order.status} → ${status}`
            });
        }

        // Si se cancela → devolver stock
        if (status === 'Cancelado') {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, {
                    $inc: { stock: item.qty }
                });
            }
        }

        // Actualizar pedido
        order.status = status;
        order.statusHistory.push({
            status,
            date: new Date(),
            note: `Estado actualizado por administrador`
        });

        await order.save();

        res.json({
            ok: true,
            msg: 'Estado del pedido actualizado correctamente',
            data: order
        });

    } catch (error) {
        console.error('[ADMIN_ORDERS_PATCH]', error);
        res.status(500).json({ ok: false, msg: 'Error al actualizar pedido' });
    }
});

module.exports = router;
