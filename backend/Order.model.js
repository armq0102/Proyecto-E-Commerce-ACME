const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
        required: true // snapshot
    },
    price: {
        type: Number,
        required: true, // snapshot
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    variant: {
        size: String,
        color: String
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: {
        type: [orderItemSchema],
        required: true
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
        default: 'pending',
        index: true
    },
    shippingAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: String,
        zip: { type: String, required: true },
        country: { type: String, required: true }
    },
    paymentMethod: {
        type: String,
        required: true
    },
    statusHistory: [{
        status: {
            type: String,
            enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
        },
        date: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true,
    versionKey: false
});

// Inicializar historial de estado
orderSchema.pre('save', function(next) {
    if (this.isNew) {
        this.statusHistory.push({ status: this.status });
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);