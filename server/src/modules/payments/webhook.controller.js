import { createHmac, timingSafeEqual } from 'node:crypto';
import { Order, Transaction } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { sendMail } from '../../utils/mailer.js';
import { failPendingPayment } from '../checkout/checkout.service.js';

function isValidSignature(rawBody, signature) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string') return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  let received;
  try {
    received = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function paystackWebhook(req, res) {
  const signature = req.get('x-paystack-signature');
  if (!isValidSignature(req.body, signature)) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid Paystack signature');
  }
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid webhook payload');
  }
  const data = event.data;
  if (!data || typeof data.reference !== 'string' || typeof data.amount !== 'number') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid Paystack webhook data');
  }
  if (event.event === 'charge.success') {
    const referencedOrder = await Order.findOne({ orderNumber: data.reference, paymentMethod: 'paystack' });
    if (!referencedOrder) throw new ApiError(404, 'NOT_FOUND', 'Paystack order not found');
    if (data.currency !== 'NGN' || data.amount !== referencedOrder.total) {
      throw new ApiError(400, 'PAYMENT_FAILED', 'Paystack amount or currency does not match the order');
    }
    if (referencedOrder.paymentStatus === 'paid' && referencedOrder.status === 'paid') {
      await Transaction.updateOne({ reference: data.reference }, { $set: { status: 'success' } });
      return res.status(200).json({});
    }
    const order = await Order.findOneAndUpdate({
      orderNumber: data.reference,
      status: 'pending_payment',
      paymentStatus: 'unpaid',
      paymentMethod: 'paystack',
      total: referencedOrder.total,
    }, {
      $set: { status: 'paid', paymentStatus: 'paid' },
      $push: { statusHistory: { status: 'paid', note: 'Paystack payment confirmed', at: new Date().toISOString() } },
    }, { new: true });
    if (order) {
      await Transaction.updateOne({ reference: data.reference }, { $set: { status: 'success' } });
      sendMail({
        to: order.customerEmail,
        subject: `Payment received for ${order.orderNumber}`,
        html: `<p>Payment for order ${order.orderNumber} was successful.</p>`,
      });
    } else {
      const current = await Order.findOne({ orderNumber: data.reference });
      if (current?.paymentStatus === 'paid') {
        await Transaction.updateOne({ reference: data.reference }, { $set: { status: 'success' } });
      }
    }
  } else if (event.event === 'charge.failed' || event.event === 'charge.abandoned') {
    await failPendingPayment(data.reference);
  }
  return res.status(200).json({});
}
