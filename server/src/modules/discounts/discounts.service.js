import { Cart, Discount } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';

export async function getApplicableDiscount(code, subtotal) {
  const discount = await Discount.findOne({ code: code.toUpperCase(), isActive: true });
  if (!discount || (discount.expiresAt && new Date(discount.expiresAt) <= new Date())
    || (discount.maxUses !== undefined && discount.usedCount >= discount.maxUses)
    || subtotal < discount.minSubtotal) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Discount code is not valid for this order');
  }
  const amount = discount.type === 'percentage'
    ? Math.floor(subtotal * discount.value / 100)
    : Math.min(subtotal, discount.value);
  return { discount, discountAmount: amount };
}

export async function validateForUser(userId, code) {
  const cart = await Cart.findOne({ userId });
  if (!cart || !cart.items.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Cart is empty');
  }
  const { readCart } = await import('../cart/cart.service.js');
  const currentCart = await readCart(userId);
  const { discountAmount } = await getApplicableDiscount(code, currentCart.subtotal);
  return { code: code.toUpperCase(), discountAmount };
}

export async function reserveDiscountUse(discountId, session, subtotal) {
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
    { new: true, session },
  );
  if (!result) throw new ApiError(400, 'VALIDATION_ERROR', 'Discount code is no longer available');
  return result;
}
