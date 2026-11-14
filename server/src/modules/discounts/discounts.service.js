import { Cart, Discount, Order } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';

export async function getApplicableDiscount(code, subtotal) {
  const discount = await Discount.findOne({ code: code.toUpperCase(), isActive: true });
  if (!discount || (discount.expiresAt && new Date(discount.expiresAt) <= new Date())
    || (discount.maxUses !== undefined && discount.usedCount >= discount.maxUses)
    || (discount.type === 'percentage' && discount.value > 100)
    || subtotal < discount.minSubtotal) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Discount code is not valid for this order');
  }
  const amount = discount.type === 'percentage'
    ? Math.min(subtotal, Math.floor(subtotal * discount.value / 100))
    : Math.min(subtotal, discount.value);
  return { discount, discountAmount: amount };
}

export async function validateForUser(userId, code, subtotal) {
  let currentSubtotal = subtotal;
  if (userId) {
    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items.length) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Cart is empty');
    }
    const { readCart } = await import('../cart/cart.service.js');
    currentSubtotal = (await readCart(userId)).subtotal;
  }
  if (typeof currentSubtotal !== 'number' || !Number.isInteger(currentSubtotal) || currentSubtotal < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Cart subtotal is required');
  }
  const { discountAmount } = await getApplicableDiscount(code, currentSubtotal);
  return { code: code.toUpperCase(), discountAmount };
}

export async function reserveDiscountUse(discountId, subtotal) {
  const result = await Discount.findOneAndUpdate(
    {
      _id: discountId,
      isActive: true,
      minSubtotal: { $lte: subtotal },
      $and: [
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
      ],
      $or: [{ maxUses: { $exists: false } }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );
  if (!result) throw new ApiError(400, 'VALIDATION_ERROR', 'Discount code is no longer available');
  return result;
}

export async function releaseDiscountUseForOrder(order) {
  if (!order.discountCode) return;
  const claimed = await Order.updateOne(
    { _id: order._id, discountUseReleased: { $ne: true } },
    { $set: { discountUseReleased: true } },
  );
  if (!claimed.modifiedCount) return;
  const released = await Discount.updateOne(
    { code: order.discountCode.toUpperCase(), usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );
  if (!released.modifiedCount) {
    throw new ApiError(500, 'INTERNAL', `Could not release discount use for order ${order.orderNumber}`);
  }
}
