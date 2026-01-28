const Product = require('../Product.model');
const PaymentSession = require('../models/PaymentSession.model');
const wompiService = require('../services/wompi.service');
const { URL } = require('url');

// Lista blanca de dominios permitidos para redirectUrl
const ALLOWED_DOMAINS = ['https://acme.com', 'http://localhost:5500', 'http://127.0.0.1:5500'];

const createWompiTransaction = async (req, res) => {
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

        const { items, redirectUrl } = req.body;

        // 2️⃣ Validación básica de carrito
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ ok: false, msg: 'El carrito está vacío.' });
        }

        // 3️⃣ Validación de redirectUrl
        let redirect;
        try {
            redirect = new URL(redirectUrl);
            if (!ALLOWED_DOMAINS.includes(`${redirect.protocol}//${redirect.host}`)) {
                return res.status(400).json({ ok: false, msg: 'redirectUrl no permitido.' });
            }
        } catch {
            redirect = new URL('http://localhost:5500');
        }

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

        // 5️⃣ Generar referencia y signature
        const amountInCents = Math.round(totalAmount * 100);
        const currency = 'COP';
        const reference = `ORDER-${req.user.userId}-${Date.now()}`;

        const signature = wompiService.generateSignature(
            reference,
            amountInCents,
            currency,
            envKeys.integritySecret
        );

        // 6️⃣ Crear PaymentSession
        await PaymentSession.create({
            reference,
            userId: req.user.userId,
            items: sessionItems,
            total: totalAmount,
            currency
        });

        // 7️⃣ Construir URL de Wompi seguro
        const params = new URLSearchParams({
            'public-key': envKeys.publicKey,
            currency,
            'amount-in-cents': amountInCents,
            reference,
            'signature:integrity': signature,
            'redirect-url': redirect.toString()
        });

        const wompiUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

        console.log(`💳 Sesión Wompi creada: ${reference} - Total: ${totalAmount} COP`);

        return res.status(200).json({ ok: true, redirectUrl: wompiUrl, reference });
    } catch (error) {
        console.error('Error al iniciar pago Wompi', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error al iniciar pago con Wompi.'
        });
    }
};

module.exports = { createWompiTransaction };