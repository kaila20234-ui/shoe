import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Cart, DeliveryZone, Discount, Order, Product, Transaction, User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { sendMail } from '../../utils/mailer.js';
import { reserveDiscountUse, getApplicableDiscount, releaseDiscountUseForOrder } from '../discounts/discounts.service.js';
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

async function rollbackStock(items) {
  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.productId, 'variants.sku': item.sku },
      { $inc: { 'variants.$.stock': item.quantity } },
    );
    if (!result.modifiedCount) throw new ApiError(500, 'INTERNAL', `Could not restore stock for SKU ${item.sku}`);
  }
}

export async function createCheckout(userId, input) {
  const cart = userId ? await Cart.findOne({ userId }) : null;
  const cartItems = userId ? cart?.items : input.items;
  if (!cartItems?.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Cart is empty');
  const shippingAddress = userId ? await resolveAddress(userId, input) : input.shippingAddress;
  if (!shippingAddress) throw new ApiError(400, 'VALIDATION_ERROR', 'Shipping address is required');
  const zone = await DeliveryZone.findOne({ _id: input.deliveryZoneId, isActive: true });
  const addressState = shippingAddress.state.trim().toLowerCase();
  if (!zone || !zone.states.some((state) => state.trim().toLowerCase() === addressState)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Delivery zone is not available for this address');
  }
  const user = userId ? await User.findById(userId) : null;
  if (userId && !user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  const customerName = user?.name ?? input.guestDetails?.name;
  const customerEmail = user?.email ?? input.guestDetails?.email;
  if (!customerName || !customerEmail) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Guest name and email are required');
  }
  const items = [];
  const productIds = cartItems.map(({ productId }) => productId);
  const skus = cartItems.map(({ sku }) => sku);
  const products = await Product.find({
    _id: { $in: productIds },
    isActive: true,
    'variants.sku': { $in: skus },
  });
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  for (const entry of cartItems) {
    const product = productsById.get(String(entry.productId));
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
  const transactionReference = input.paymentMethod === 'pay_on_delivery' ? `POD-${orderNumber}` : orderNumber;
  const guestAccessToken = !userId && input.paymentMethod === 'paystack'
    ? randomBytes(32).toString('hex')
    : undefined;
  const reservedItems = [];
  const originalCartItems = cart?.items.map(({ productId, sku, quantity }) => ({ productId, sku, quantity }));
  let reservedDiscountId;
  let order;
  let cartCleared = false;
  try {
    for (const item of items) {
      const result = await Product.updateOne(
        {
          _id: item.productId,
          isActive: true,
          variants: { $elemMatch: { sku: item.sku, stock: { $gte: item.quantity } } },
        },
        { $inc: { 'variants.$.stock': -item.quantity } },
      );
      if (!result.modifiedCount) throw new ApiError(409, 'OUT_OF_STOCK', `Insufficient stock for SKU ${item.sku}`);
      reservedItems.push(item);
    }
    if (applicable) {
      await reserveDiscountUse(applicable.discount.id, subtotal);
      reservedDiscountId = applicable.discount.id;
    }
    order = await Order.create({
      orderNumber,
      ...(user ? { customerId: String(user.id) } : {}),
      customerName,
      customerEmail,
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
      ...(guestAccessToken ? {
        guestAccessTokenHash: createHash('sha256').update(guestAccessToken).digest('hex'),
        guestAccessTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } : {}),
    });
    await Transaction.create({
      reference: transactionReference,
      orderId: String(order.id),
      orderNumber,
      ...(user ? { customerId: String(user.id) } : {}),
      customerName,
      amount: total,
      method: input.paymentMethod,
      status: 'pending',
    });
    if (cart) {
      cart.items = [];
      await cart.save();
      cartCleared = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    if (order) {
      try {
        await Order.deleteOne({ _id: order.id });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    try {
      await Transaction.deleteOne({ reference: transactionReference });
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (reservedDiscountId) {
      try {
        await Discount.updateOne({ _id: reservedDiscountId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    try {
      await rollbackStock(reservedItems);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (cartCleared) {
      try {
        cart.items = originalCartItems;
        await cart.save();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], 'Checkout failed and compensation was incomplete');
    }
    throw error;
  }
  if (input.paymentMethod === 'pay_on_delivery') {
    sendMail({
      to: customerEmail,
      subject: `Order ${orderNumber} received`,
      html: `<p>We received your order ${orderNumber}.</p>`,
    });
    return { order };
  }
  try {
    const payment = await initializePayment({ email: customerEmail, amount: total, reference: orderNumber });
    sendMail({
      to: customerEmail,
      subject: `Order ${orderNumber} received`,
      html: `<p>We received your order ${orderNumber}.</p>`,
    });
    return {
      order,
      ...(guestAccessToken ? { guestAccessToken } : {}),
      paystack: { authorizationUrl: payment.authorization_url, reference: orderNumber },
    };
  } catch (error) {
    const rollbackErrors = [];
    try {
      await failPendingPayment(orderNumber);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (cartCleared) {
      try {
        cart.items = originalCartItems;
        await cart.save();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], 'Payment initialization failed and checkout compensation was incomplete');
    }
    throw error;
  }
}

export async function failPendingPayment(reference) {
  const order = await Order.findOneAndUpdate(
    { orderNumber: reference, status: 'pending_payment', paymentStatus: 'unpaid' },
    {
      $set: { paymentStatus: 'failed' },
      $push: { statusHistory: { status: 'pending_payment', note: 'Payment failed', at: new Date().toISOString() } },
    },
    { new: true },
  );
  if (!order) return;
  await releaseDiscountUseForOrder(order);
  await rollbackStock(order.items);
  await Transaction.updateOne({ reference }, { $set: { status: 'failed' } });
}
