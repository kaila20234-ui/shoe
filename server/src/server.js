import app from './app.js';
import { connectDatabase } from './config/db.js';
import { loadEnv, validateEnvironment } from './config/env.js';
import { startPendingPaymentExpirationJob } from './jobs/expirePendingPayments.js';

loadEnv();
validateEnvironment();
await connectDatabase();
const stopPendingPaymentExpirationJob = startPendingPaymentExpirationJob(
  Number(process.env.PENDING_PAYMENT_EXPIRATION_MINUTES || 30),
);

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, '0.0.0.0', () => {
  console.info(`Shoe Store API listening on port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopPendingPaymentExpirationJob();
    server.close(async () => {
      const { default: mongoose } = await import('mongoose');
      await mongoose.disconnect();
      process.exit(0);
    });
  });
}
