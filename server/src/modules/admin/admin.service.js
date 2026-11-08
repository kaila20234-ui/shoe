import { DeliveryZone, Discount, Order, Transaction } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { listAdminOrders, changeOrderStatus } from '../orders/orders.service.js';
import { listForModeration, moderateReview } from '../reviews/reviews.service.js';
import { listAdminReturns, updateReturn } from '../returns/returns.service.js';
import { createProduct, listAdminProducts, setStock, updateProduct, lowStock } from '../products/products.service.js';

export { listAdminOrders, changeOrderStatus, listForModeration, moderateReview, listAdminReturns, updateReturn, createProduct, listAdminProducts, setStock, updateProduct, lowStock };

export async function dashboardSummary() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  const dayStart = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+01:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const [todayOrders, revenue, pendingOrders, lowStockItems, recentOrders] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
    Transaction.aggregate([
      { $match: { status: 'success', createdAt: { $gte: dayStart, $lt: dayEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Order.countDocuments({ status: { $in: ['paid', 'pending_payment'] } }),
    lowStock(5),
    Order.find().sort({ createdAt: -1 }).limit(5),
  ]);
  return {
    todayOrders,
    todayRevenue: revenue[0]?.total ?? 0,
    pendingOrders,
    lowStockCount: lowStockItems.length,
    recentOrders,
    lowStockItems,
  };
}

export async function listZones() {
  return DeliveryZone.find().sort({ name: 1 });
}

export async function createZone(input) {
  return DeliveryZone.create(input);
}

export async function updateZone(id, input) {
  const zone = await DeliveryZone.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!zone) throw new ApiError(404, 'NOT_FOUND', 'Delivery zone not found');
  return zone;
}

export async function removeZone(id) {
  const zone = await DeliveryZone.findByIdAndDelete(id);
  if (!zone) throw new ApiError(404, 'NOT_FOUND', 'Delivery zone not found');
}

export async function listDiscounts() {
  return Discount.find().sort({ createdAt: -1 });
}

export async function createDiscount(input) {
  return Discount.create(input);
}

export async function updateDiscount(id, input) {
  const discount = await Discount.findById(id);
  if (!discount) throw new ApiError(404, 'NOT_FOUND', 'Discount not found');
  const type = input.type ?? discount.type;
  const value = input.value ?? discount.value;
  if (type === 'percentage' && value > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Percentage cannot exceed 100');
  }
  Object.assign(discount, input);
  await discount.save();
  return discount;
}

export async function removeDiscount(id) {
  const discount = await Discount.findByIdAndDelete(id);
  if (!discount) throw new ApiError(404, 'NOT_FOUND', 'Discount not found');
}

export async function lowStockList(threshold) {
  return lowStock(threshold);
}
