const { Router } = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Product = require('../Product.model');
const Order = require('../Order.model');
const User = require('../User.model');
const verifyToken = require('../auth.middleware');

const router = Router();

const hasCloudinaryConfig = () => (
    !!process.env.CLOUDINARY_CLOUD_NAME &&
    !!process.env.CLOUDINARY_API_KEY &&
    !!process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinaryConfig()) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

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
// RUTAS DE SUBIDA DE ARCHIVOS
// ==========================================

// POST /api/admin/products/upload - Subir imagen
router.post('/products/upload', async (req, res) => {
    try {
        const { file, filename } = req.body;

        if (!file || !filename) {
            return res.status(400).json({ ok: false, msg: 'Falta archivo o nombre' });
        }

        if (!hasCloudinaryConfig()) {
            return res.status(500).json({ ok: false, msg: 'Cloudinary no está configurado' });
        }

        const ext = path.extname(filename).replace('.', '').toLowerCase();
        const mimeExt = ext === 'jpg' ? 'jpeg' : (ext || 'jpeg');
        const dataUri = `data:image/${mimeExt};base64,${file}`;
        const publicId = path.parse(filename).name;

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder: 'acme/products',
            public_id: publicId,
            overwrite: true,
            resource_type: 'image'
        });

        res.json({ ok: true, imgPath: uploadResult.secure_url });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ ok: false, msg: 'Error al subir la imagen' });
    }
});

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
        const { name, price, stock, imageUrl, status, category } = req.body;
        
        const newProduct = new Product({
            title: name,
            price,
            stock,
            img: imageUrl,
            category: category || 'Otros',
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
        const { name, price, stock, imageUrl, status, category } = req.body;

        // CORRECCIÓN: Construir objeto explícito para asegurar que 'status' entra
        // y que los nombres de campos coinciden con el Schema.
        const updateData = {
            title: name,       // Frontend envía 'name', DB usa 'title'
            price,
            stock,
            img: imageUrl,     // Frontend envía 'imageUrl', DB usa 'img'
            category,
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

// DELETE /api/admin/products/:id (Eliminar)
router.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({ ok: false, msg: 'Producto no encontrado' });
        }

        res.json({ ok: true, msg: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: 'Error eliminando producto' });
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

// ==========================================
// ENDPOINT TEMPORAL: Migrar URLs a Cloudinary
// ==========================================
router.get('/migrate-cloudinary', async (req, res) => {
    try {
        if (!hasCloudinaryConfig()) {
            return res.status(500).json({ ok: false, msg: 'Cloudinary no está configurado en el servidor' });
        }

        // Mapa manual de imágenes conocidas (basado en el upload realizado)
        const imageMap = {
            '1.png': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331082/acme/products/1.png',
            '2.png': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331083/acme/products/2.png',
            '3.png': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331083/acme/products/3.png',
            '4.png': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331084/acme/products/4.png',
            '5.png': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331084/acme/products/5.png',
            'Blusa camisera para mujer manga larga.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331085/acme/products/Blusa%20camisera%20para%20mujer%20manga%20larga.webp',
            'Camisa azul clásica para niño.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331086/acme/products/Camisa%20azul%20cl%C3%A1sica%20para%20ni%C3%B1o.webp',
            'camisa clasica blanca.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331086/acme/products/camisa%20clasica%20blanca.webp',
            'Camisa clásica para hombre Morado.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331087/acme/products/Camisa%20cl%C3%A1sica%20para%20hombre%20Morado.webp',
            'Camisa Manga Larga Para Mujer Iconic Western.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331087/acme/products/Camisa%20Manga%20Larga%20Para%20Mujer%20Iconic%20Western.webp',
            'Camisa Oxford Hombre Azul oscura.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331088/acme/products/Camisa%20Oxford%20Hombre%20Azul%20oscura.webp',
            'Camisas de Moda para Mujer.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331089/acme/products/Camisas%20de%20Moda%20para%20Mujer.webp',
            'Camisas Manga Larga para hombre.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331090/acme/products/Camisas%20Manga%20Larga%20para%20hombre.webp',
            'Camisas para Mujer Armatura.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331090/acme/products/Camisas%20para%20Mujer%20Armatura.webp',
            'Camiseta deportiva de futbol para niño unisex.webp': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331091/acme/products/Camiseta%20deportiva%20de%20futbol%20para%20ni%C3%B1o%20unisex.webp',
            'Camiseta Lilo y Stitch.jpg': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331091/acme/products/Camiseta%20Lilo%20y%20Stitch.jpg',
            'Camiseta Para Niña Cuello Redondo Screen.jpg': 'https://res.cloudinary.com/dbeu6q8qp/image/upload/v1770331092/acme/products/Camiseta%20Para%20Ni%C3%B1a%20Cuello%20Redondo%20Screen.jpg'
        };

        const products = await Product.find({});
        let updated = 0;
        let skipped = 0;
        let errors = [];

        for (const product of products) {
            const img = product.img || '';

            // Si ya es URL de Cloudinary, saltar
            if (/cloudinary\.com/i.test(img)) {
                skipped++;
                continue;
            }

            // Extraer nombre del archivo
            const filename = path.basename(img);
            const cloudUrl = imageMap[filename];

            if (cloudUrl) {
                try {
                    product.img = cloudUrl;
                    await product.save();
                    updated++;
                } catch (error) {
                    errors.push({ product: product.title, filename, error: error.message });
                }
            } else {
                skipped++;
                errors.push({ product: product.title, filename, error: 'No se encontró en el mapa de imágenes' });
            }
        }

        res.json({
            ok: true,
            msg: 'Migración completada',
            stats: {
                total: products.length,
                updated,
                skipped,
                errors: errors.length
            },
            errors
        });

    } catch (error) {
        console.error('Error en migración:', error);
        res.status(500).json({ ok: false, msg: 'Error en la migración', error: error.message });
    }
});

module.exports = router;