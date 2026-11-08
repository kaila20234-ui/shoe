import { Order } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { verifyPayment } from './paystack.client.js';

export async function verifyForCustomer(userId, reference) {
  const order = await Order.findOne({ orderNumber: reference, customerId: String(userId) });
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
  if (order.paymentMethod !== 'paystack') throw new ApiError(400, 'VALIDATION_ERROR', 'Order does not use Paystack');
  const payment = await verifyPayment(reference);
  if (payment.status !== 'success' || payment.reference !== reference
    || payment.amount !== order.total || payment.currency !== 'NGN') {
    throw new ApiError(402, 'PAYMENT_FAILED', 'Paystack payment details do not match this order');
  }
  return Order.findById(order.id);
}
