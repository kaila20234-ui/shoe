import app from './app.js';
import { config } from './config/env.js';
import { connectDatabase } from './config/db.js';
import mongoose from 'mongoose';

let server;

async function start() {
  await connectDatabase();
  server = app.listen(config.port, () => {
    console.info(`Shoe Store API listening on port ${config.port}`);
  });
  server.on('error', (error) => {
    console.error('HTTP server failed:', error);
    process.exitCode = 1;
  });
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

start().catch(async (error) => {
  console.error('Unable to start server:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
