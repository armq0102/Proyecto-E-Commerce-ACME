const mongoose = require('mongoose');
const Product = require('../Product.model');
const Order = require('../Order.model');
const User = require('../User.model');
const PaymentSession = require('../PaymentSession.model');
const wompiService = require('../wompi.service');
const crypto = require('crypto');

const createTransaction = async (req, res) => {
    try {
        // 1️⃣ Validación de entorno
        const envKeys =
            process.env.NODE_ENV === 'production'
                ? {
                      publicKey: process.env.WOMPI_PUBLIC_KEY,
                      integritySecret: process.env.WOMPI_INTEGRITY_SECRET
                  }
                : {
                      publicKey: process.env.WOMPI_PUBLIC_KEY_TEST,
                      integritySecret: process.env.WOMPI_INTEGRITY_SECRET_TEST
                  };

        if (!envKeys.publicKey || !envKeys.integritySecret) {
            console.error(
                '❌ Faltan variables de entorno de Wompi para el entorno actual'
            );
            return res
                .status(500)
                .json({ ok: false, msg: 'Error interno de configuración de pagos.' });
        }

        const { items } = req.body || {};

        // 2️⃣ Validación básica de carrito
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ ok: false, msg: 'El carrito está vacío.' });
        }

        const redirectUrl =
            process.env.NODE_ENV === 'production'
                ? `${process.env.FRONTEND_URL}/profile.html#pedidos`
                : 'http://localhost:5500/profile.html#pedidos'; // En dev local, Wompi redirige al localhost del usuario


        // 4️⃣ Validación de productos
        const sessionItems = [];
        let totalAmount = 0;
        const errors = [];

        for (const item of items) {
            const productId = item._id || item.id;
            const product = await Product.findById(productId);

            const qty = parseInt(item.qty);
            if (!product) {
                errors.push(`Producto no encontrado: ${productId}`);
                continue;
            }
            if (product.status !== 'active' || product.stock < qty) {
                errors.push(
                    `Producto no disponible o sin stock suficiente: ${product.title}`
                );
                continue;
            }

            if (!qty || qty <= 0) {
                errors.push(`Cantidad inválida para producto: ${productId}`);
                continue;
            }

            totalAmount += product.price * qty;
            sessionItems.push({
                productId: product._id,
                title: product.title,
                price: product.price,
                qty
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({ ok: false, msg: 'Errores en carrito.', errors });
        }

        // 5️⃣ CREAR ORDEN (ESTADO: PENDIENTE) - "Source of Truth"
        // La orden existe ANTES de pagar.
        const user = await User.findById(req.user.userId);
        const newOrder = new Order({
            userId: req.user.userId,
            items: sessionItems,
            total: totalAmount,
            shippingAddress: user ? user.address : 'Dirección no disponible',
            status: 'Pendiente', // Estado inicial
            statusHistory: [{ status: 'Pendiente', note: 'Iniciando pago Wompi', date: new Date() }]
        });

        await newOrder.save();

        // 6️⃣ Generar referencia y signature vinculada a la Orden
        const amountInCents = Math.round(totalAmount * 100);
        const currency = 'COP';
        const reference = `TX-${newOrder._id}-${Date.now()}`; // Referencia única de pago

        const signature = wompiService.generateSignature(
            reference,
            amountInCents,
            currency,
            envKeys.integritySecret
        );

        // 7️⃣ Crear PaymentSession vinculada a la Orden
        await PaymentSession.create({
            reference,
            userId: req.user.userId,
            orderId: newOrder._id, // VINCULACIÓN CRÍTICA
            items: sessionItems,
            total: totalAmount,
            currency,
            amountInCents
        });

        // 8️⃣ Construir URL de Wompi seguro
        const params = new URLSearchParams({
            'public-key': envKeys.publicKey,
            currency,
            'amount-in-cents': amountInCents,
            reference,
            'signature:integrity': signature,
            'redirect-url': redirectUrl
        });

        const wompiUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

        console.log(`💳 Orden ${newOrder._id} creada (Pendiente). Iniciando pago: ${reference}`);

        return res.status(200).json({ ok: true, redirectUrl: wompiUrl, reference });
    } catch (error) {
        console.error('Error al iniciar pago Wompi', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error al iniciar pago con Wompi.'
        });
    }
};

const handleWebhook = async (req, res) => {
    try {
        const { event, data, signature, timestamp } = req.body || {};

        // 1. Validar que sea un evento de transacción
        if (event !== 'transaction.updated') {
            return res.status(200).json({ ok: true, msg: 'Evento ignorado' });
        }

        const transaction = data.transaction;
        
        // 2. Validar Firma de Integridad (SEGURIDAD CRÍTICA)
        // Wompi firma: SHA256(transaction.id + transaction.status + transaction.amount_in_cents + timestamp + secret)
        const integritySecret = process.env.NODE_ENV === 'production' 
            ? process.env.WOMPI_INTEGRITY_SECRET 
            : process.env.WOMPI_INTEGRITY_SECRET_TEST;

        const chain = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${integritySecret}`;
        const calculatedSignature = crypto.createHash('sha256').update(chain).digest('hex');

        if (calculatedSignature !== signature.checksum) {
            console.error('❌ Firma inválida en Webhook Wompi');
            return res.status(400).json({ ok: false, msg: 'Firma inválida' });
        }

        // 3. Verificar Estado de la Transacción
        if (transaction.status !== 'APPROVED') {
            console.log(`⚠️ Transacción no aprobada: ${transaction.status}`);
            return res.status(200).json({ ok: true, msg: 'Transacción no aprobada' });
        }

        // 4. Buscar la Sesión y la Orden
        const reference = transaction.reference;
        const session = await PaymentSession.findOne({ reference });

        if (!session) {
            console.error(`❌ Sesión no encontrada para ref: ${reference}`);
            return res.status(404).json({ ok: false, msg: 'Sesión perdida' });
        }

        const order = await Order.findById(session.orderId);
        if (!order) {
            console.error(`❌ Orden no encontrada: ${session.orderId}`);
            return res.status(404).json({ ok: false, msg: 'Orden perdida' });
        }

        // 5. IDEMPOTENCIA REAL
        // Si la orden ya está pagada, no hacemos NADA.
        if (order.status === 'Pagado') {
            console.log(`ℹ️ Webhook duplicado ignorado. Orden ${order._id} ya pagada.`);
            return res.status(200).json({ ok: true, msg: 'Ya procesado' });
        }

        // 6. ATOMICIDAD (Transacción MongoDB)
        // Iniciamos una sesión para garantizar que el stock se descuente TODO o NADA.
        const dbSession = await mongoose.startSession();
        dbSession.startTransaction();

        try {
            // A. Descontar Stock
            for (const item of session.items) {
                const updatedProduct = await Product.findOneAndUpdate(
                    { _id: item.productId, stock: { $gte: item.qty } }, // Condición: Hay stock suficiente
                    { $inc: { stock: -item.qty } }, // Acción: Restar
                    { session: dbSession, new: true } // Opciones: Usar sesión
                );

                if (!updatedProduct) {
                    throw new Error(`Stock insuficiente para producto ${item.productId}`);
                }
            }

            // B. Actualizar Orden
            order.status = 'Pagado';
            order.statusHistory.push({
                status: 'Pagado',
                note: `Pago Wompi Aprobado. Ref: ${reference}`,
                date: new Date()
            });
            
            // Guardar ID de transacción para auditoría
            order.paymentInfo = {
                transactionId: transaction.id,
                gateway: 'Wompi',
                amount: transaction.amount_in_cents
            };

            await order.save({ session: dbSession });

            // C. Confirmar Transacción
            await dbSession.commitTransaction();
            dbSession.endSession();

            console.log(`✅ Orden ${order._id} PAGADA y Stock descontado.`);
            return res.status(200).json({ ok: true, msg: 'Orden procesada' });

        } catch (err) {
            // D. Rollback en caso de error (ej: sin stock en el último item)
            await dbSession.abortTransaction();
            dbSession.endSession();
            
            console.error(`❌ Error en transacción de orden ${order._id}:`, err.message);
            // Opcional: Marcar orden como "Fallida" o "Reembolso Requerido"
            return res.status(400).json({ ok: false, msg: 'Error procesando stock' });
        }

    } catch (error) {
        console.error('Error procesando webhook:', error);
        return res.status(500).json({ ok: false, msg: 'Error interno' });
    }
};

module.exports = { createTransaction, handleWebhook };
