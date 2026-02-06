const { Router } = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Product = require('../Product.model');
const Order = require('../Order.model');
const User = require('../User.model');
const verifyToken = require('../auth.middleware');
const { sendError } = require('../utils/response');
const { z, validate } = require('../utils/validate');

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
        return sendError(res, 403, 'Acceso denegado. Requiere rol de administrador.');
    }
    next();
});

// Configuración de Estados de Pedidos
const VALID_STATUSES = ['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado'];
const STATUS_FLOW = {
    Pendiente: ['Pagado', 'Cancelado'],
    Pagado: ['Enviado', 'Cancelado'],
    Enviado: ['Entregado'],
    Entregado: [],
    Cancelado: []
};

const uploadSchema = z.object({
    file: z.string().min(1, 'Archivo requerido.'),
    filename: z.string().min(1, 'Nombre de archivo requerido.')
});

const productSchema = z.object({
    name: z.string().trim().min(2, 'Nombre de producto requerido.'),
    price: z.number().min(0, 'Precio invalido.'),
    stock: z.number().int().min(0, 'Stock invalido.'),
    imageUrl: z.string().min(1, 'Imagen requerida.'),
    status: z.enum(['active', 'hidden', 'out_of_stock']).optional(),
    category: z.string().trim().min(1, 'Categoria requerida.').optional()
});

const orderStatusSchema = z.object({
    status: z.enum(['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado'])
});

const userStatusSchema = z.object({
    status: z.enum(['active', 'suspended'])
});

// ==========================================
// RUTAS DE SUBIDA DE ARCHIVOS
// ==========================================

// POST /api/admin/products/upload - Subir imagen
router.post('/products/upload', validate(uploadSchema), async (req, res) => {
    try {
        const { file, filename } = req.body;

        if (!file || !filename) {
            return sendError(res, 400, 'Falta archivo o nombre');
        }

        if (!hasCloudinaryConfig()) {
            return sendError(res, 500, 'Cloudinary no está configurado');
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
        return sendError(res, 500, 'Error al subir la imagen', error.message);
    }
});

// ==========================================
// RUTAS DE PRODUCTOS (Inventario)
// ==========================================

// GET /api/admin/products
router.get('/products', async (req, res) => {
    try {
        const search = (req.query.q || '').trim();
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const skip = (page - 1) * limit;

        const query = {};
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { title: searchRegex }
            ];

            if (mongoose.isValidObjectId(search)) {
                query.$or.push({ _id: search });
            }
        }

        const [items, total] = await Promise.all([
            Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Product.countDocuments(query)
        ]);

        const pages = Math.max(Math.ceil(total / limit), 1);
        res.json({ items, page, limit, total, pages });
    } catch (error) {
        return sendError(res, 500, 'Error obteniendo productos', error.message);
    }
});

// POST /api/admin/products (Crear)
router.post('/products', validate(productSchema), async (req, res) => {
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
        return sendError(res, 500, 'Error creando producto', error.message);
    }
});

// PUT /api/admin/products/:id (Editar - Aquí estaba el error principal)
router.put('/products/:id', validate(productSchema), async (req, res) => {
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
            return sendError(res, 404, 'Producto no encontrado');
        }

        res.json(product);
    } catch (error) {
        console.error(error);
        return sendError(res, 500, 'Error actualizando producto', error.message);
    }
});

// DELETE /api/admin/products/:id (Eliminar)
router.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return sendError(res, 404, 'Producto no encontrado');
        }

        res.json({ ok: true, msg: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error(error);
        return sendError(res, 500, 'Error eliminando producto', error.message);
    }
});

// ==========================================
// OTRAS RUTAS ADMIN (Soporte para admin.js)
// ==========================================

router.get('/orders', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            Order.find()
                .populate('userId', 'name email')
                .populate('items.productId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Order.countDocuments()
        ]);

        const pages = Math.max(Math.ceil(total / limit), 1);
        res.json({ items, page, limit, total, pages });
    } catch (error) {
        return sendError(res, 500, 'Error obteniendo pedidos', error.message);
    }
});

// PATCH /api/admin/orders/:id/status (Actualizar estado)
router.patch('/orders/:id/status', validate(orderStatusSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // 1. Validaciones básicas
        if (!mongoose.isValidObjectId(id)) {
            return sendError(res, 400, 'ID de pedido inválido');
        }
        if (!VALID_STATUSES.includes(status)) {
            return sendError(res, 400, `Estado inválido. Permitidos: ${VALID_STATUSES.join(', ')}`);
        }

        const order = await Order.findById(id);
        if (!order) {
            return sendError(res, 404, 'Pedido no encontrado');
        }

        // 2. Validar flujo de estados (Reglas de negocio)
        if (['Entregado', 'Cancelado'].includes(order.status)) {
            return sendError(res, 409, `El pedido ya está ${order.status} y no se puede modificar.`);
        }

        const allowedNext = STATUS_FLOW[order.status] || [];
        if (!allowedNext.includes(status)) {
            return sendError(res, 409, `Transición no permitida: de ${order.status} a ${status}`);
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
        return sendError(res, 500, 'Error al actualizar el estado del pedido', error.message);
    }
});

router.get('/users', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
            User.countDocuments()
        ]);

        const pages = Math.max(Math.ceil(total / limit), 1);
        res.json({ items, page, limit, total, pages });
    } catch (error) {
        return sendError(res, 500, 'Error obteniendo usuarios', error.message);
    }
});

// PATCH /api/admin/users/:id/status (Suspender/Activar)
router.patch('/users/:id/status', validate(userStatusSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // 1. Validaciones
        if (!mongoose.isValidObjectId(id)) {
            return sendError(res, 400, 'ID de usuario inválido.');
        }
        if (!['active', 'suspended'].includes(status)) {
            return sendError(res, 400, 'Estado no válido. Solo se permite "active" o "suspended".');
        }

        // 2. Regla de negocio: No se puede suspender al admin logueado
        if (req.user.userId === id) {
            return sendError(res, 403, 'No puedes cambiar tu propio estado.');
        }

        // 3. Actualizar usuario
        const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-password');
        if (!user) return sendError(res, 404, 'Usuario no encontrado.');

        res.json({ ok: true, msg: `El estado del usuario ha sido actualizado.`, user });
    } catch (error) {
        return sendError(res, 500, 'Error interno del servidor.', error.message);
    }
});


module.exports = router;
