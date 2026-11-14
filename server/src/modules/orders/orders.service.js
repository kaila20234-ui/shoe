import { Order, Transaction, Product } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';
import { sendMail } from '../../utils/mailer.js';
import { logAudit } from '../../utils/audit.js';
import { refundPayment } from '../payments/paystack.client.js';
import { releaseDiscountUseForOrder } from '../discounts/discounts.service.js';

const transitions = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['packed', 'cancelled', 'refunded'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

async function restoreOrderStock(order) {
  for (const item of order.items) {
    const result = await Product.updateOne(
      { _id: item.productId, 'variants.sku': item.sku },
      { $inc: { 'variants.$.stock': item.quantity } },
    );
    if (!result.modifiedCount) throw new ApiError(500, 'INTERNAL', `Could not restore stock for SKU ${item.sku}`);
  }
}

async function flagOrderForManualReview(order, reason, cause) {
  try {
    const result = await Order.updateOne(
      { _id: order._id },
      { $set: { manualReviewRequired: true } },
    );
    if (!result.modifiedCount) throw new ApiError(500, 'INTERNAL', 'Could not flag order for manual review');
  } catch (error) {
    console.error('Could not flag order for manual review.', { reference: order.orderNumber, reason, error });
    throw new AggregateError([cause, error], `Order ${order.orderNumber} requires manual review`);
  }
  console.error('Order flagged for manual review.', { reference: order.orderNumber, reason });
}

async function restoreOrderAfterRefundFailure(order, expectedStatus, previousStatus, note, byUserId, cause) {
  let restored;
  try {
    restored = await Order.findOneAndUpdate(
      { _id: order._id, status: expectedStatus, paymentStatus: order.paymentStatus },
      {
        $set: { status: previousStatus },
        $push: {
          statusHistory: {
            status: previousStatus,
            note: note
              ? `${note} (refund failed; order status restored)`
              : 'Order status restored because the refund failed',
            at: new Date().toISOString(),
            ...(byUserId ? { byUserId: String(byUserId) } : {}),
          },
        },
      },
      { new: true },
    );
  } catch (restoreError) {
    await flagOrderForManualReview(order, 'refund_failed_and_status_restore_failed', new AggregateError([cause, restoreError]));
    throw new AggregateError([cause, restoreError], `Could not restore order ${order.orderNumber} after refund failure`);
  }
  if (!restored) {
    await flagOrderForManualReview(order, 'refund_failed_and_status_restore_failed', cause);
    throw new AggregateError([cause], `Could not restore order ${order.orderNumber} after refund failure`);
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

  const previous = order.status;
  const isPaidPaystackRefund = order.paymentMethod === 'paystack' && order.paymentStatus === 'paid'
    && (nextStatus === 'cancelled' || nextStatus === 'refunded');
  let updated = await Order.findOneAndUpdate(
    { _id: orderId, status: previous },
    {
      $set: {
        status: nextStatus,
        ...(nextStatus === 'refunded' && !isPaidPaystackRefund ? { paymentStatus: 'refunded' } : {}),
        ...(nextStatus === 'delivered' && order.paymentMethod === 'pay_on_delivery' ? { paymentStatus: 'paid' } : {}),
      },
      $push: {
        statusHistory: {
          status: nextStatus,
          ...(note ? { note } : {}),
          at: new Date().toISOString(),
          byUserId: String(req.user.id),
        },
      },
    },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'CONFLICT', 'Order status changed concurrently; reload and retry');
  if (isPaidPaystackRefund) {
    try {
      await refundPayment(order.orderNumber);
    } catch (refundError) {
      await restoreOrderAfterRefundFailure(order, nextStatus, previous, note, req.user.id, refundError);
      throw refundError;
    }
    const refunded = await Order.findOneAndUpdate(
      { _id: order.id, status: nextStatus, paymentStatus: order.paymentStatus },
      { $set: { paymentStatus: 'refunded' } },
      { new: true },
    );
    if (!refunded) {
      const error = new ApiError(409, 'CONFLICT', 'Refund succeeded but order payment status could not be updated');
      await flagOrderForManualReview(order, 'refund_status_update_failed', error);
      throw error;
    }
    updated = refunded;
  }
  if (nextStatus === 'cancelled' || nextStatus === 'refunded') await restoreOrderStock(updated);
  if (nextStatus === 'refunded' || isPaidPaystackRefund) {
    await Transaction.updateOne({ orderId: String(order.id) }, { $set: { status: 'refunded' } });
  } else if (nextStatus === 'cancelled') {
    await Transaction.updateOne({ orderId: String(order.id) }, { $set: { status: 'failed' } });
  } else if (nextStatus === 'delivered' && order.paymentMethod === 'pay_on_delivery') {
    await Transaction.updateOne({ orderId: String(order.id) }, { $set: { status: 'success' } });
  }
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
  const previous = order.status;
  const isRefund = order.paymentMethod === 'paystack' && order.paymentStatus === 'paid';
  const stockAlreadyRestored = order.paymentStatus === 'failed';
  let current = await Order.findOneAndUpdate(
    { _id: order.id, customerId: String(userId), status: previous, paymentStatus: order.paymentStatus },
    {
      $set: { status: 'cancelled' },
      $push: { statusHistory: { status: 'cancelled', note: 'Cancelled by customer', at: new Date().toISOString(), byUserId: String(userId) } },
    },
    { new: true },
  );
  if (!current) throw new ApiError(409, 'CONFLICT', 'Order status changed concurrently; reload and retry');
  if (isRefund) {
    try {
      await refundPayment(order.orderNumber);
    } catch (refundError) {
      await restoreOrderAfterRefundFailure(order, 'cancelled', previous, undefined, userId, refundError);
      throw refundError;
    }
    current = await Order.findOneAndUpdate(
      { _id: order.id, status: 'cancelled', paymentStatus: order.paymentStatus },
      { $set: { paymentStatus: 'refunded' } },
      { new: true },
    );
    if (!current) {
      const error = new ApiError(409, 'CONFLICT', 'Refund succeeded but order payment status could not be updated');
      await flagOrderForManualReview(order, 'refund_status_update_failed', error);
      throw error;
    }
  }
  await releaseDiscountUseForOrder(current);
  if (!stockAlreadyRestored) await restoreOrderStock(current);
  await Transaction.updateOne(
    { orderId: String(current.id) },
    { $set: { status: isRefund ? 'refunded' : 'failed' } },
  );
  return current;
}
