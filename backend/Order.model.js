const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    qty: {
        type: Number,
        required: true,
        min: 1
    }
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // 🔥 mejora de performance real
    },
    items: {
        type: [orderItemSchema],
        required: true,
        validate: [arr => arr.length > 0, 'El pedido debe tener al menos un producto']
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    shippingAddress: { 
        type: String, 
        required: true,
        minlength: [10, 'La dirección es muy corta, por favor detalla más.']
    },
    status: {
        type: String,
        enum: ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'],
        default: 'Pendiente',
        index: true
    },
    statusHistory: {
        type: [statusHistorySchema],
        default: []
    }
}, {
    timestamps: true
});

// Red de seguridad: recalcular total si alguien intenta manipular datos
orderSchema.pre('save', function(next) {
    if (this.items?.length) {
        this.total = this.items.reduce(
            (sum, item) => sum + (item.price * item.qty),
            0
        );
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);
