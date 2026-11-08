import mongoose from 'mongoose';
import { Order, ReturnRequest, Transaction, Product } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';
import { refundPayment } from '../payments/paystack.client.js';

export async function createReturn(userId, input) {
  const order = await Order.findOne({ _id: input.orderId, customerId: String(userId), status: 'delivered' });
  if (!order) throw new ApiError(400, 'VALIDATION_ERROR', 'A delivered order belonging to you is required');
  const existing = await ReturnRequest.find({ orderId: String(order.id), status: { $in: ['requested', 'approved', 'refunded'] } });
  for (const requested of input.items) {
    const purchased = order.items.filter((item) => item.sku === requested.sku)
      .reduce((sum, item) => sum + item.quantity, 0);
    const alreadyRequested = existing
      .flatMap((record) => record.items)
      .filter((item) => item.sku === requested.sku)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (purchased === 0 || alreadyRequested + requested.quantity > purchased) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Return quantity exceeds the delivered quantity for ${requested.sku}`);
    }
  }
  return ReturnRequest.create({
    orderId: String(order.id),
    orderNumber: order.orderNumber,
    customerId: String(userId),
    items: input.items,
    reason: input.reason,
    status: 'requested',
  });
}

export async function listCustomerReturns(userId) {
  return ReturnRequest.find({ customerId: String(userId) }).sort({ createdAt: -1 });
}

export async function listAdminReturns(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    ReturnRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ReturnRequest.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function updateReturn(id, status, adminNote, actorId) {
  const returnRequest = await ReturnRequest.findById(id);
  if (!returnRequest) throw new ApiError(404, 'NOT_FOUND', 'Return request not found');
  const allowed = {
    requested: ['approved', 'rejected'],
    approved: ['refunded'],
    rejected: [],
    refunded: [],
  };
  if (!allowed[returnRequest.status].includes(status)) {
    throw new ApiError(409, 'CONFLICT', `Cannot transition return from ${returnRequest.status} to ${status}`);
  }
  const order = await Order.findById(returnRequest.orderId);
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Related order not found');
  if (status === 'refunded') {
    const returnedQuantities = new Map(returnRequest.items.map((item) => [item.sku, item.quantity]));
    const isFullOrderReturn = order.items.every((item) => returnedQuantities.get(item.sku) === item.quantity)
      && returnedQuantities.size === order.items.length;
    if (!isFullOrderReturn) {
      throw new ApiError(409, 'CONFLICT', 'The contract only defines full-order refunds; partial refund accounting is unresolved');
    }
  }
  if (status === 'refunded' && order.paymentMethod === 'paystack' && order.paymentStatus === 'paid') {
    await refundPayment(order.orderNumber);
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await ReturnRequest.findOneAndUpdate(
        { _id: id, status: returnRequest.status },
        { $set: { status, ...(adminNote !== undefined ? { adminNote } : {}) } },
        { new: true, session },
      );
      if (!current) throw new ApiError(409, 'CONFLICT', 'Return request changed concurrently');
      if (status === 'refunded') {
        const orderUpdate = await Order.updateOne(
          { _id: order.id, status: 'delivered' },
          {
            $set: { status: 'refunded', paymentStatus: 'refunded' },
            $push: {
              statusHistory: {
                status: 'refunded',
                ...(adminNote ? { note: adminNote } : {}),
                at: new Date().toISOString(),
                ...(actorId ? { byUserId: String(actorId) } : {}),
              },
            },
          },
          { session },
        );
        if (!orderUpdate.modifiedCount) throw new ApiError(409, 'CONFLICT', 'Related order is no longer refundable');
        await Transaction.updateOne({ orderId: String(order.id) }, { $set: { status: 'refunded' } }, { session });
        for (const item of returnRequest.items) {
          const productItem = order.items.find((line) => line.sku === item.sku);
          if (!productItem) continue;
          const result = await Product.updateOne(
            { _id: productItem.productId, 'variants.sku': item.sku },
            { $inc: { 'variants.$.stock': item.quantity } },
            { session },
          );
          if (!result.modifiedCount) throw new ApiError(500, 'INTERNAL', `Could not restock SKU ${item.sku}`);
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return ReturnRequest.findById(id);
}
