import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './owner.controller.js';
import {
  transactionQuerySchema, transactionExportSchema, reportQuerySchema,
  topProductsQuerySchema, auditQuerySchema,
} from './owner.schemas.js';

const ownerRouter = Router();
ownerRouter.get('/transactions/export', validate({ query: transactionExportSchema }), asyncHandler(controller.exportCsv));
ownerRouter.get('/transactions/:id', asyncHandler(controller.detail));
ownerRouter.get('/transactions', validate({ query: transactionQuerySchema }), asyncHandler(controller.listTransactions));
ownerRouter.get('/reports/summary', validate({ query: reportQuerySchema }), asyncHandler(controller.summary));
ownerRouter.get('/reports/top-products', validate({ query: topProductsQuerySchema }), asyncHandler(controller.products));

export const auditLogsRouter = Router();
auditLogsRouter.get('/', validate({ query: auditQuerySchema }), asyncHandler(controller.auditLogs));

export default ownerRouter;
