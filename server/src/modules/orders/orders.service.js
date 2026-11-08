import mongoose from 'mongoose';
import { Order, Transaction, Product } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';
import { sendMail } from '../../utils/mailer.js';
import { logAudit } from '../../utils/audit.js';
import { refundPayment } from '../payments/paystack.client.js';

const transitions = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['packed', 'cancelled', 'refunded'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

async function restoreOrderStock(order, session) {
  for (const item of order.items) {
    const result = await Product.updateOne(
      { _id: item.productId, 'variants.sku': item.sku },
      { $inc: { 'variants.$.stock': item.quantity } },
      { session },
    );
    if (!result.modifiedCount) throw new ApiError(500, 'INTERNAL', `Could not restore stock for SKU ${item.sku}`);
  }
}

export async function listCustomerOrders(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { customerId: String(userId) };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getCustomerOrder(userId, id) {
  const order = await Order.findOne({ _id: id, customerId: String(userId) });
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
  return order;
}

export async function listAdminOrders(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { orderNumber: new RegExp(escaped, 'i') },
      { customerName: new RegExp(escaped, 'i') },
      { customerEmail: new RegExp(escaped, 'i') },
    ];
  }
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function changeOrderStatus(req, orderId, nextStatus, note) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
  if (!transitions[order.status]?.includes(nextStatus)) {
    throw new ApiError(409, 'CONFLICT', `Cannot transition order from ${order.status} to ${nextStatus}`);
  }
  if (nextStatus === 'paid' && order.paymentMethod === 'paystack') {
    throw new ApiError(409, 'CONFLICT', 'Paystack orders are marked paid only by the verified webhook');
  }

  if ((nextStatus === 'cancelled' || nextStatus === 'refunded')
    && order.paymentMethod === 'paystack' && order.paymentStatus === 'paid') {
    await refundPayment(order.orderNumber);
  }

  const previous = order.status;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await Order.findOneAndUpdate(
        { _id: orderId, status: previous },
        {
          $set: {
            status: nextStatus,
            ...(nextStatus === 'refunded' ? { paymentStatus: 'refunded' } : {}),
            ...((nextStatus === 'cancelled' || nextStatus === 'refunded')
              && order.paymentMethod === 'paystack' && order.paymentStatus === 'paid'
              ? { paymentStatus: 'refunded' }
              : {}),
            ...(nextStatus === 'delivered' && order.paymentMethod === 'pay_on_delivery' ? { paymentStatus: 'paid' } : {}),
          },
          $push: { statusHistory: { status: nextStatus, ...(note ? { note } : {}), at: new Date().toISOString(), byUserId: String(req.user.id) } },
        },
        { new: true, session },
      );
      if (!current) throw new ApiError(409, 'CONFLICT', 'Order status changed concurrently; reload and retry');
      if (nextStatus === 'cancelled' || nextStatus === 'refunded') {
        await restoreOrderStock(current, session);
      }
      if (nextStatus === 'refunded' || (nextStatus === 'cancelled' && order.paymentMethod === 'paystack' && order.paymentStatus === 'paid')) {
        await Transaction.updateOne(
          { orderId: String(order.id) },
          { $set: { status: 'refunded' } },
          { session },
        );
      } else if (nextStatus === 'cancelled') {
        await Transaction.updateOne({ orderId: String(order.id) }, { $set: { status: 'failed' } }, { session });
      } else if (nextStatus === 'delivered' && order.paymentMethod === 'pay_on_delivery') {
        await Transaction.updateOne({ orderId: String(order.id) }, { $set: { status: 'success' } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  const updated = await Order.findById(orderId);
  await logAudit(req, {
    action: 'order.status_change',
    entity: 'order',
    entityId: String(updated.id),
    meta: { from: previous, to: nextStatus, note },
  });
  if (nextStatus === 'shipped' || nextStatus === 'delivered') {
    sendMail({
      to: updated.customerEmail,
      subject: `Order ${updated.orderNumber} ${nextStatus}`,
      html: `<p>Your order ${updated.orderNumber} is ${nextStatus}.</p>`,
    });
  }
  return updated;
}

export async function cancelCustomerOrder(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId: String(userId) });
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
  if (!['pending_payment', 'paid'].includes(order.status)) {
    throw new ApiError(409, 'CONFLICT', 'This order can no longer be cancelled');
  }
  if (order.paymentMethod === 'paystack' && order.paymentStatus === 'paid') {
    await refundPayment(order.orderNumber);
  }
  const previous = order.status;
  const isRefund = order.paymentMethod === 'paystack' && order.paymentStatus === 'paid';
  const stockAlreadyRestored = order.paymentStatus === 'failed';
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await Order.findOneAndUpdate(
        { _id: order.id, customerId: String(userId), status: previous, paymentStatus: order.paymentStatus },
        {
          $set: { status: 'cancelled', ...(isRefund ? { paymentStatus: 'refunded' } : {}) },
          $push: { statusHistory: { status: 'cancelled', note: 'Cancelled by customer', at: new Date().toISOString(), byUserId: String(userId) } },
        },
        { new: true, session },
      );
      if (!current) throw new ApiError(409, 'CONFLICT', 'Order status changed concurrently; reload and retry');
      if (!stockAlreadyRestored) await restoreOrderStock(current, session);
      await Transaction.updateOne(
        { orderId: String(current.id) },
        { $set: { status: isRefund ? 'refunded' : 'failed' } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return Order.findById(order.id);
}
