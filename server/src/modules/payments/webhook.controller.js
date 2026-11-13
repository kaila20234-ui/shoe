import { createHmac, timingSafeEqual } from 'node:crypto';
import ApiError from '../../utils/ApiError.js';
import { failPendingPayment } from '../checkout/checkout.service.js';
import { confirmSuccessfulPayment } from './payments.service.js';

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
    await confirmSuccessfulPayment(data);
  } else if (event.event === 'charge.failed' || event.event === 'charge.abandoned') {
    await failPendingPayment(data.reference);
  }
  return res.status(200).json({});
}
