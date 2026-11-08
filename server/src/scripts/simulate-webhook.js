import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { Order } from '../models/index.js';

const reference = process.argv[2];
if (!reference) {
  throw new Error('Usage: node server/src/scripts/simulate-webhook.js <order-reference> [webhook-url]');
}
if (!process.env.MONGODB_URI || !process.env.PAYSTACK_SECRET_KEY) {
  throw new Error('MONGODB_URI and PAYSTACK_SECRET_KEY must be set in the environment');
}

const webhookUrl = process.argv[3] || `http://localhost:${process.env.PORT || 5000}/api/payments/paystack/webhook`;

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const order = await Order.findOne({ orderNumber: reference, paymentMethod: 'paystack' });
  if (!order) throw new Error(`Paystack order not found: ${reference}`);

  const rawBody = JSON.stringify({
    event: 'charge.success',
    data: {
      reference: order.orderNumber,
      amount: order.total,
      currency: 'NGN',
      status: 'success',
    },
  });
  const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': signature,
    },
    body: rawBody,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Webhook returned ${response.status}: ${body}`);
  }
  console.log(`Signed charge.success event delivered for ${reference}`);
} finally {
  await mongoose.disconnect();
}
