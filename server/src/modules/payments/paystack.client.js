import ApiError from '../../utils/ApiError.js';

const PAYSTACK_API = 'https://api.paystack.co';

async function paystackRequest(path, options = {}) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new ApiError(500, 'INTERNAL', 'Paystack is not configured');
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok || !body.status) {
    throw new ApiError(402, 'PAYMENT_FAILED', body.message || 'Paystack request failed');
  }
  return body.data;
}

export async function initializePayment({ email, amount, reference }) {
  if (process.env.PAYSTACK_SECRET_KEY === 'sk_test_local_simulated') {
    const callback = `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout/verify?reference=${encodeURIComponent(reference)}`;
    return { authorization_url: callback, reference, amount, email };
  }
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount,
      reference,
      callback_url: `${process.env.CLIENT_URL}/checkout/verify`,
    }),
  });
}

export async function verifyPayment(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
}

export async function refundPayment(reference) {
  return paystackRequest('/refund', {
    method: 'POST',
    body: JSON.stringify({ transaction: reference }),
  });
}
