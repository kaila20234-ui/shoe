import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv() {
  const filename = resolve(process.cwd(), '.env');
  if (!existsSync(filename)) return;
  for (const line of readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith('#')) continue;
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const key = entry.slice(0, separator).trim();
    let value = entry.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function validateEnvironment(env = process.env) {
  const required = ['JWT_SECRET', 'MONGODB_URI', 'PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY'];
  if (env.NODE_ENV === 'production') required.push('CLIENT_URL');
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (env.CLIENT_URL?.trim()) {
    let clientUrl;
    try {
      clientUrl = new URL(env.CLIENT_URL);
    } catch {
      throw new Error('CLIENT_URL must be a valid absolute URL');
    }
    if (clientUrl.protocol !== 'http:' && clientUrl.protocol !== 'https:') {
      throw new Error('CLIENT_URL must use HTTP or HTTPS');
    }
  }
  if (env.NODE_ENV === 'production' && env.PAYSTACK_SECRET_KEY === 'sk_test_local_simulated') {
    throw new Error('The simulated Paystack secret cannot be used in production');
  }
  const expirationMinutes = Number(env.PENDING_PAYMENT_EXPIRATION_MINUTES ?? 30);
  if (!Number.isInteger(expirationMinutes) || expirationMinutes <= 0) {
    throw new Error('PENDING_PAYMENT_EXPIRATION_MINUTES must be a positive integer');
  }
}
