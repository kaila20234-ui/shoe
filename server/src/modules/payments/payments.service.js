import { Order, Transaction } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { sendMail } from '../../utils/mailer.js';
import { verifyPayment } from './paystack.client.js';

export async function confirmSuccessfulPayment({ reference, amount, currency }) {
  const order = await Order.findOne({ orderNumber: reference, paymentMethod: 'paystack' });
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Paystack order not found');
  if (currency !== 'NGN' || amount !== order.total) {
    throw new ApiError(400, 'PAYMENT_FAILED', 'Paystack amount or currency does not match the order');
  }
  if (order.paymentStatus === 'paid') {
    await Transaction.updateOne({ reference }, { $set: { status: 'success' } });
    return order;
  }

  const updated = await Order.findOneAndUpdate({
    orderNumber: reference,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentMethod: 'paystack',
    total: order.total,
  }, {
    $set: { status: 'paid', paymentStatus: 'paid' },
    $push: { statusHistory: { status: 'paid', note: 'Paystack payment confirmed', at: new Date().toISOString() } },
  }, { new: true });

  if (updated) {
    await Transaction.updateOne({ reference }, { $set: { status: 'success' } });
    sendMail({
      to: updated.customerEmail,
      subject: `Payment received for ${updated.orderNumber}`,
      html: `<p>Payment for order ${updated.orderNumber} was successful.</p>`,
    });
    return updated;
  }

  const current = await Order.findOne({ orderNumber: reference, paymentMethod: 'paystack' });
  if (current?.paymentStatus === 'paid') {
    await Transaction.updateOne({ reference }, { $set: { status: 'success' } });
    return current;
  }
  throw new ApiError(409, 'CONFLICT', 'Paystack payment was confirmed, but the order status could not be updated');
}

export async function verifyForCustomer(userId, reference) {
  const order = await Order.findOne({ orderNumber: reference, customerId: String(userId) });
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
  if (order.paymentMethod !== 'paystack') throw new ApiError(400, 'VALIDATION_ERROR', 'Order does not use Paystack');
  if (order.paymentStatus === 'paid') return order;
  const payment = await verifyPayment(reference);
  if (payment.status !== 'success' || payment.reference !== reference
    || payment.amount !== order.total || payment.currency !== 'NGN') {
    throw new ApiError(402, 'PAYMENT_FAILED', 'Paystack payment details do not match this order');
  }
  return confirmSuccessfulPayment(payment);
}
