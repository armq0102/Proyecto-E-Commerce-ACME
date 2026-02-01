const mongoose = require('mongoose');

const paymentSessionSchema = new mongoose.Schema({
    reference: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        title: String,
        price: Number,
        qty: Number
    }],
    total: { type: Number, required: true },
    amountInCents: { type: Number },
    currency: { type: String, default: 'COP' },
    createdAt: { type: Date, default: Date.now, expires: '24h' } // Se borra solo después de 24h
});

module.exports = mongoose.model('PaymentSession', paymentSessionSchema);