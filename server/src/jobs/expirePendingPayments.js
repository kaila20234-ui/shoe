import { Order } from '../models/index.js';
import { failPendingPayment } from '../modules/checkout/checkout.service.js';

const intervalMilliseconds = 5 * 60 * 1000;

export function startPendingPaymentExpirationJob(expirationMinutes) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const cutoff = new Date(Date.now() - expirationMinutes * 60 * 1000);
      const orders = await Order.find({
        paymentMethod: 'paystack',
        status: 'pending_payment',
        paymentStatus: 'unpaid',
        createdAt: { $lte: cutoff },
      }).select('orderNumber').limit(100).lean();
      for (const order of orders) {
        try {
          await failPendingPayment(order.orderNumber);
        } catch (error) {
          console.error('Failed to expire pending Paystack order.', {
            reference: order.orderNumber,
            error,
          });
        }
      }
    } catch (error) {
      console.error('Pending Paystack order expiration job failed.', error);
    } finally {
      running = false;
    }
  }, intervalMilliseconds);
  return () => clearInterval(timer);
}
