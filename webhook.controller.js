const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const PaymentSession = require('../models/PaymentSession.model');
const wompiService = require('../services/wompi.service');

const handleWompiWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { data, signature, timestamp } = req.body || {};

    // 1️⃣ Validación básica del payload
    if (!data || !data.transaction || !signature || !timestamp) {
      console.warn('[Webhook] Payload inválido o incompleto');
      return res.status(200).json({ ok: false, msg: 'Payload inválido o incompleto' });
    }

    const { transaction } = data;

    // 2️⃣ Verificación de firma según entorno
    const secret =
      process.env.NODE_ENV === 'production'
        ? process.env.WOMPI_EVENTS_SECRET
        : process.env.WOMPI_EVENTS_SECRET_TEST;

    if (!secret) {
      console.error('[Webhook] Secret de Wompi no configurado');
      return res.status(500).json({ ok: false, msg: 'Error de configuración' });
    }

    const isValid = wompiService.verifyWebhookSignature(
      signature.checksum,
      transaction.id,
      transaction.status,
      transaction.amount_in_cents,
      timestamp,
      secret
    );

    if (!isValid) {
      console.warn(`[Webhook] Firma inválida para transacción ${transaction.id}`);
      return res.status(401).json({ ok: false, msg: 'Firma inválida' });
    }

    // 3️⃣ Idempotencia real usando unique index
    const existingOrder = await Order.findOne({ 'paymentInfo.id': transaction.id });
    if (existingOrder) {
      console.log(`[Webhook] Evento ya procesado (orden existente): ${transaction.id}`);
      return res.status(200).json({ ok: true, msg: 'Evento ya procesado (orden existente)' });
    }

    // 4️⃣ Solo procesar transacciones aprobadas
    if (transaction.status !== 'APPROVED') {
      console.log(`[Webhook] Transacción no aprobada: ${transaction.id}`);
      return res.status(200).json({ ok: true, msg: 'Transacción no aprobada, ignorada' });
    }

    // 5️⃣ Recuperar sesión de pago
    const paymentSession = await PaymentSession.findOne({ reference: transaction.reference });
    if (!paymentSession) {
      console.error(`[Webhook] Sesión no encontrada para referencia ${transaction.reference}`);
      return res.status(200).json({ ok: false, msg: 'Sesión no encontrada (ignorada)' });
    }

    // 6️⃣ Validación de integridad financiera
    const sessionAmountInCents = Math.round(paymentSession.total * 100);
    if (transaction.currency !== 'COP') {
      console.error(`[Webhook] Moneda inválida: ${transaction.currency}`);
      return res.status(200).json({ ok: false, msg: 'Moneda incorrecta' });
    }
    if (transaction.amount_in_cents !== sessionAmountInCents) {
      console.error(
        `[Webhook] Discrepancia de montos. Esperado ${sessionAmountInCents}, recibido ${transaction.amount_in_cents}`
      );
      return res.status(200).json({ ok: false, msg: 'Discrepancia de montos' });
    }

    // 7️⃣ Validación de existencia de productos antes de descuento
    const productIds = paymentSession.items.map(item => item.productId);
    const productsInDB = await Product.find({ _id: { $in: productIds } }).session(session);
    const missingProducts = productIds.filter(id => !productsInDB.some(p => p._id.equals(id)));
    if (missingProducts.length > 0) {
      console.error(`[Webhook] Productos no encontrados: ${missingProducts.join(', ')}`);
      return res.status(200).json({ ok: false, msg: 'Productos no encontrados', errors: missingProducts });
    }

    // 8️⃣ Crear orden definitiva
    const newOrder = new Order({
      userId: paymentSession.userId,
      items: paymentSession.items,
      total: paymentSession.total,
      paymentInfo: {
        id: transaction.id,
        reference: transaction.reference,
        status: transaction.status
      }
    });

    await newOrder.save({ session });

    // 9️⃣ Descontar stock
    for (const item of paymentSession.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.qty } },
        { session }
      );
    }

    // 🔟 Limpiar sesión temporal
    await PaymentSession.deleteOne({ reference: transaction.reference }).session(session);

    // 11️⃣ Commit transacción
    await session.commitTransaction();
    session.endSession();

    console.log(`[Webhook] Orden creada exitosamente: ${newOrder._id}`);
    return res.status(200).json({ ok: true, msg: 'Orden creada exitosamente' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[Webhook] Error procesando webhook', error);
    return res.status(200).json({ ok: false, msg: 'Error interno procesando webhook' });
  }
};

module.exports = { handleWompiWebhook };