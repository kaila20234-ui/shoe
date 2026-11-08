import express from 'express';

export function notImplemented(req, res) {
  return res.status(501).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Not implemented' },
  });
}

export function createNotImplementedRouter() {
  const router = express.Router();
  router.all('*', notImplemented);
  return router;
}
