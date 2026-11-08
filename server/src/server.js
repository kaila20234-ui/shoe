import app from './app.js';
import { connectDatabase } from './config/db.js';
import { loadEnv } from './config/env.js';

loadEnv();
await connectDatabase();

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, '0.0.0.0', () => {
  console.info(`Shoe Store API listening on port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      const { default: mongoose } = await import('mongoose');
      await mongoose.disconnect();
      process.exit(0);
    });
  });
}
