const { Router } = require('express');
const { Product } = require('../db.js');

const router = Router();

// GET /api/admin/products
router.get('/', (req, res) => {
    try {
        const products = Product.findAll();
        res.json(products);
    } catch (error) {
        console.error('Error admin products:', error);
        res.status(500).json({ message: 'Error al obtener inventario' });
    }
});

// POST /api/admin/products
router.post('/', (req, res) => {
    try {
        const { name, price, stock, imageUrl, status } = req.body;

        // Validaciones estrictas
        if (!name || typeof name !== 'string') return res.status(400).json({ message: 'Nombre inválido' });
        if (!imageUrl || typeof imageUrl !== 'string') return res.status(400).json({ message: 'Imagen inválida' });
        if (price === undefined || price <= 0) return res.status(400).json({ message: 'Precio debe ser mayor a 0' });
        if (stock === undefined || stock < 0) return res.status(400).json({ message: 'Stock no puede ser negativo' });

        const allowedStatus = ['active', 'hidden', 'out_of_stock'];
        if (status && !allowedStatus.includes(status)) {
            return res.status(400).json({ message: 'Estado inválido' });
        }

        // Verificar duplicados por nombre (Case insensitive)
        const products = Product.findAll();
        const exists = products.some(p => p.title.toLowerCase() === name.trim().toLowerCase());
        if (exists) return res.status(409).json({ message: 'El producto ya existe' });

        const newProduct = {
            // ID se genera automáticamente en db.js si no se envía
            title: name.trim(),
            price: Number(price),
            stock: Number(stock),
            img: imageUrl,
            status: (Number(stock) === 0) ? 'out_of_stock' : (status || 'active'),
            createdAt: new Date().toISOString()
        };

        const created = Product.create(newProduct);
        res.status(201).json({ message: 'Producto creado', product: created });

    } catch (error) {
        console.error('Error creando producto:', error);
        res.status(500).json({ message: 'Error interno al crear producto' });
    }
});

// PUT /api/admin/products/:id (Edición completa)
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, stock, imageUrl, status } = req.body;

        const product = Product.findById(id);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        const updates = {};
        if (name) updates.title = name;
        if (price !== undefined) updates.price = Number(price);
        if (stock !== undefined) updates.stock = Number(stock);
        if (imageUrl) updates.img = imageUrl;
        
        // Lógica de estado automática
        if (updates.stock === 0) {
            updates.status = 'out_of_stock';
        } else if (status) {
            const allowedStatus = ['active', 'hidden', 'out_of_stock'];
            if (allowedStatus.includes(status)) updates.status = status;
        }

        const updatedProduct = Product.updateById(id, updates);
        res.json({ message: 'Producto actualizado', product: updatedProduct });

    } catch (error) {
        console.error('Error editando producto:', error);
        res.status(500).json({ message: 'Error interno al editar producto' });
    }
});

// PATCH /api/admin/products/:id/status (Cambio rápido de estado)
router.patch('/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validación estricta de estado (Recomendación Senior)
        const allowedStatus = ['active', 'hidden', 'out_of_stock'];
        if (!status || !allowedStatus.includes(status)) {
            return res.status(400).json({ 
                message: `Estado inválido. Permitidos: ${allowedStatus.join(', ')}` 
            });
        }
        
        const product = Product.findById(id);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        const updated = Product.updateById(id, { status });
        res.json({ message: 'Estado actualizado', product: updated });
    } catch (error) {
        res.status(500).json({ message: 'Error al cambiar estado' });
    }
});

// PATCH /api/admin/products/:id (Actualización rápida de stock)
// Nota: Esta ruta maneja el stock absoluto, no delta.
router.patch('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;

        if (stock === undefined || !Number.isInteger(stock) || stock < 0) {
            return res.status(400).json({ message: 'Stock inválido' });
        }

        const product = Product.findById(id);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        const updates = { 
            stock: stock,
            updatedAt: new Date().toISOString()
        };
        
        // Si el stock sube de 0, reactivamos si estaba out_of_stock
        if (stock > 0 && product.status === 'out_of_stock') {
            updates.status = 'active';
        }

        const updated = Product.updateById(id, updates);
        res.json({ message: 'Stock actualizado', product: updated });

    } catch (error) {
        res.status(500).json({ message: 'Error interno al actualizar stock' });
    }
});

module.exports = router;