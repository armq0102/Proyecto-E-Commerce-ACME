const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    img: { type: String, required: true },
    category: { type: String, default: 'Otros' },
    status: {
        type: String,
        enum: ['active', 'hidden', 'out_of_stock'],
        default: 'active'
    }
}, {
    timestamps: true,
    // Configuración para devolver 'id' en lugar de '_id' al frontend
    toJSON: {
        virtuals: true,
        versionKey: false,
        transform: function (doc, ret) { delete ret._id; }
    },
    toObject: { virtuals: true }
});

// Indexar título para búsquedas rápidas
productSchema.index({ title: 'text' });
productSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);