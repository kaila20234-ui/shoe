import { ok } from '../../utils/respond.js';
import * as service from './owner.service.js';

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export async function listTransactions(req, res) {
  const result = await service.listTransactions(req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function detail(req, res) {
  return ok(res, await service.getTransaction(req.params.id));
}

export async function exportCsv(req, res) {
  const cursor = await service.exportTransactions(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
  res.write('Date,Reference,OrderNumber,Customer,Method,Status,Amount(NGN)\r\n');
  for await (const transaction of cursor) {
    res.write([
      transaction.createdAt.toISOString(),
      transaction.reference,
      transaction.orderNumber,
      transaction.customerName,
      transaction.method,
      transaction.status,
      (transaction.amount / 100).toFixed(2),
    ].map(csvCell).join(',') + '\r\n');
  }
  return res.end();
}

export async function summary(req, res) {
  return ok(res, await service.reportSummary(req.query));
}

export async function products(req, res) {
  return ok(res, await service.topProducts(req.query));
}

export async function auditLogs(req, res) {
  const result = await service.listAuditLogs(req.query);
  return ok(res, result.items, { meta: result.meta });
}
