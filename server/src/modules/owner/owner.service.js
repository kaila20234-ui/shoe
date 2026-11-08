import { AuditLog, Order, Transaction } from '../../models/index.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';
import ApiError from '../../utils/ApiError.js';

function transactionFilter(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.method) filter.method = query.method;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  if (query.q) {
    const text = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { reference: new RegExp(text, 'i') },
      { orderNumber: new RegExp(text, 'i') },
      { customerName: new RegExp(text, 'i') },
    ];
  }
  return filter;
}

export async function listTransactions(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = transactionFilter(query);
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getTransaction(id) {
  const transaction = await Transaction.findById(id);
  if (!transaction) throw new ApiError(404, 'NOT_FOUND', 'Transaction not found');
  const order = await Order.findById(transaction.orderId);
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Related order not found');
  return { transaction, order };
}

export async function exportTransactions(query) {
  return Transaction.find(transactionFilter(query)).sort({ createdAt: -1 }).cursor();
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result;
}

function addPeriod(date, period) {
  const result = new Date(date);
  if (period === 'daily') result.setUTCDate(result.getUTCDate() + 1);
  else if (period === 'weekly') result.setUTCDate(result.getUTCDate() + 7);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

function bucketDate(date, period) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  if (period === 'weekly') return startOfWeek(result);
  if (period === 'monthly') result.setUTCDate(1);
  return result;
}

export async function reportSummary(query) {
  const now = new Date();
  const from = query.from ? new Date(query.from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  const to = query.to ? new Date(query.to) : now;
  if (from >= to) throw new ApiError(400, 'VALIDATION_ERROR', 'from must be earlier than to');
  const start = bucketDate(from, query.period);
  const end = bucketDate(to, query.period);
  const dateMatch = { createdAt: { $gte: from, $lte: to } };
  const orderMatch = {
    ...dateMatch,
    status: { $in: ['paid', 'packed', 'shipped', 'delivered', 'refunded'] },
  };
  const [success, refunds, byDate, orderCount] = await Promise.all([
    Transaction.aggregate([
      { $match: { ...dateMatch, status: 'success' } },
      { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { ...dateMatch, status: 'refunded' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { ...dateMatch, status: 'success' } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit: query.period === 'daily' ? 'day' : query.period === 'weekly' ? 'week' : 'month', startOfWeek: 'monday' } },
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.countDocuments(orderMatch),
  ]);
  const buckets = new Map(byDate.map((row) => [bucketDate(row._id, query.period).toISOString(), row]));
  const series = [];
  for (let cursor = start; cursor <= end; cursor = addPeriod(cursor, query.period)) {
    const row = buckets.get(cursor.toISOString());
    series.push({
      date: cursor.toISOString().slice(0, 10),
      revenue: row?.revenue ?? 0,
      orders: row?.orders ?? 0,
    });
  }
  const totalRevenue = success[0]?.revenue ?? 0;
  return {
    period: query.period,
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      revenue: totalRevenue,
      orders: orderCount,
      refunds: refunds[0]?.amount ?? 0,
      averageOrderValue: orderCount ? Math.round(totalRevenue / orderCount) : 0,
    },
    series,
  };
}

export async function topProducts(query) {
  const match = {};
  if (query.from || query.to) {
    match.createdAt = {};
    if (query.from) match.createdAt.$gte = new Date(query.from);
    if (query.to) match.createdAt.$lte = new Date(query.to);
  }
  match.status = { $nin: ['cancelled', 'refunded', 'pending_payment'] };
  return Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
      },
    },
    { $sort: { unitsSold: -1, revenue: -1 } },
    { $limit: query.limit },
    { $project: { _id: 0, productId: '$_id', name: 1, unitsSold: 1, revenue: 1 } },
  ]);
}

export async function listAuditLogs(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.actorId) filter.actorId = query.actorId;
  if (query.entity) filter.entity = query.entity;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}
