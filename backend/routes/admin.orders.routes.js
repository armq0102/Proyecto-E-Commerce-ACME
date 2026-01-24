const { Router } = require('express');
const { Order, Product } = require('../db.js');

const router = Router();

// GET /api/admin/orders
router.get('/', (req, res) => {
    try {
        const orders = Order.findAll();
        // Ordenar por fecha descendente
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(orders);
    } catch (error) {
        console.error('Error admin orders:', error);
        res.status(500).json({ message: 'Error al obtener el listado de órdenes' });
    }
});

// PATCH /api/admin/orders/:id
router.patch('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'El estado es obligatorio' });
        }

        const VALID_STATUSES = ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'];
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ 
                message: `Estado inválido. Permitidos: ${VALID_STATUSES.join(', ')}` 
            });
        }

        const order = Order.findById(id);
        if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

        // --- REGLAS DE NEGOCIO ---

        // 1. Bloquear cambios si ya está cancelado
        if (order.status === 'Cancelado') {
            return res.status(400).json({ message: 'No se puede modificar un pedido cancelado.' });
        }

        // 2. DEVOLUCIÓN DE STOCK AL CANCELAR
        // Usamos Product.updateStock para operaciones atómicas/seguras
        if (status === 'Cancelado' && order.status !== 'Cancelado') {
            // Iteramos sobre los items y devolvemos el stock uno a uno
            // Nota: Usamos 'qty' e 'id' para mantener compatibilidad con el frontend actual
            for (const item of order.items) {
                if (item.id && item.qty) {
                    Product.updateStock(item.id, item.qty);
                }
            }
        }

        // 3. ACTUALIZAR HISTORIAL
        if (!order.statusHistory) order.statusHistory = [];
        
        order.statusHistory.push({
            from: order.status,
            to: status,
            date: new Date().toISOString(),
            updatedBy: req.user.email || 'Admin'
        });

        // 4. Actualizar estado
        // Usamos updateStatus del repositorio para ser más semánticos
        const updatedOrder = Order.updateStatus(id, status);
        
        // Si updateStatus no existiera en db.js, haríamos fallback a update manual:
        // order.status = status;
        // order.updatedAt = new Date().toISOString();
        // Order.update(order);

        res.json({ message: 'Estado actualizado correctamente', order: updatedOrder || order });

    } catch (error) {
        console.error('Error actualizando orden:', error);
        res.status(500).json({ message: 'Error interno al actualizar la orden' });
    }
});

module.exports = router;