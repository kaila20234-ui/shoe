import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { Cart, DeliveryZone, Discount, Order, Product, Transaction, User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { sendMail } from '../../utils/mailer.js';
import { reserveDiscountUse, getApplicableDiscount } from '../discounts/discounts.service.js';
import { initializePayment } from '../payments/paystack.client.js';

async function makeOrderNumber() {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `SS-${day}-${String(randomInt(0, 100000)).padStart(5, '0')}`;
    if (!await Order.exists({ orderNumber: candidate })) return candidate;
  }
  throw new ApiError(409, 'CONFLICT', 'Could not allocate an order number; retry checkout');
}

async function resolveAddress(userId, input) {
  if (input.shippingAddress) return input.shippingAddress;
  const user = await User.findById(userId);
  const address = user?.addresses.find((item) => String(item.id ?? item._id) === input.addressId);
  if (!address) throw new ApiError(400, 'VALIDATION_ERROR', 'Saved address not found');
  const { recipient, phone, street, city, state, landmark } = address;
  return { recipient, phone, street, city, state, ...(landmark ? { landmark } : {}) };
}

async function rollbackStock(items, session) {
  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.productId, 'variants.sku': item.sku },
      { $inc: { 'variants.$.stock': item.quantity } },
      { session },
    );
    if (!result.modifiedCount) throw new ApiError(500, 'INTERNAL', `Could not restore stock for SKU ${item.sku}`);
  }
}

export async function createCheckout(userId, input) {
  const cart = await Cart.findOne({ userId });
  if (!cart?.items.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Cart is empty');
  const shippingAddress = await resolveAddress(userId, input);
  const zone = await DeliveryZone.findOne({ _id: input.deliveryZoneId, isActive: true });
  if (!zone || !zone.states.includes(shippingAddress.state)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Delivery zone is not available for this address');
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  const items = [];
  for (const entry of cart.items) {
    const product = await Product.findOne({ _id: entry.productId, isActive: true, 'variants.sku': entry.sku });
    const variant = product?.variants.find(({ sku }) => sku === entry.sku);
    if (!product || !variant || variant.stock < entry.quantity) {
      throw new ApiError(409, 'OUT_OF_STOCK', `Insufficient stock for SKU ${entry.sku}`);
    }
    items.push({
      productId: String(product.id),
      sku: variant.sku,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      unitPrice: product.salePrice ?? product.price,
      quantity: entry.quantity,
    });
  }
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const applicable = input.discountCode
    ? await getApplicableDiscount(input.discountCode, subtotal)
    : undefined;
  const discountAmount = applicable?.discountAmount ?? 0;
  const total = subtotal - discountAmount + zone.fee;
  const orderNumber = await makeOrderNumber();
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        const result = await Product.updateOne(
          {
            _id: item.productId,
            isActive: true,
            variants: { $elemMatch: { sku: item.sku, stock: { $gte: item.quantity } } },
          },
          { $inc: { 'variants.$.stock': -item.quantity } },
          { session },
        );
        if (!result.modifiedCount) throw new ApiError(409, 'OUT_OF_STOCK', `Insufficient stock for SKU ${item.sku}`);
      }
      if (applicable) await reserveDiscountUse(applicable.discount.id, session, subtotal);
      [order] = await Order.create([{
        orderNumber,
        customerId: String(user.id),
        customerName: user.name,
        customerEmail: user.email,
        items,
        subtotal,
        ...(input.discountCode ? { discountCode: input.discountCode } : {}),
        discountAmount,
        deliveryFee: zone.fee,
        total,
        shippingAddress,
        deliveryZoneId: String(zone.id),
        paymentMethod: input.paymentMethod,
        paymentStatus: 'unpaid',
        status: 'pending_payment',
        statusHistory: [{ status: 'pending_payment', at: new Date().toISOString() }],
      }], { session });
      await Transaction.create([{
        reference: input.paymentMethod === 'pay_on_delivery' ? `POD-${orderNumber}` : orderNumber,
        orderId: String(order.id),
        orderNumber,
        customerId: String(user.id),
        customerName: user.name,
        amount: total,
        method: input.paymentMethod,
        status: input.paymentMethod === 'pay_on_delivery' ? 'pending' : 'pending',
      }], { session });
      cart.items = [];
      await cart.save({ session });
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
  sendMail({
    to: user.email,
    subject: `Order ${orderNumber} received`,
    html: `<p>We received your order ${orderNumber}.</p>`,
  });
  if (input.paymentMethod === 'pay_on_delivery') return { order };
  try {
    const payment = await initializePayment({ email: user.email, amount: total, reference: orderNumber });
    return { order, paystack: { authorizationUrl: payment.authorization_url, reference: orderNumber } };
  } catch (error) {
    await failPendingPayment(orderNumber);
    throw error;
  }
}

export async function failPendingPayment(reference) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderNumber: reference, status: 'pending_payment', paymentStatus: 'unpaid' }).session(session);
      if (!order) return;
      order.paymentStatus = 'failed';
      order.statusHistory.push({ status: 'pending_payment', note: 'Payment failed', at: new Date().toISOString() });
      await order.save({ session });
      await rollbackStock(order.items, session);
      await Transaction.updateOne({ reference }, { $set: { status: 'failed' } }, { session });
    });
  } finally {
    await session.endSession();
  }
}
