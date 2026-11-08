import { Cart, Product } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId, items: [] });
  return cart;
}

export async function readCart(userId) {
  const cart = await getOrCreateCart(userId);
  const enriched = [];
  for (const item of cart.items) {
    const product = await Product.findOne({
      _id: item.productId,
      isActive: true,
      'variants.sku': item.sku,
    });
    if (!product) continue;
    const variant = product.variants.find(({ sku }) => sku === item.sku);
    if (!variant) continue;
    enriched.push({
      productId: String(product.id),
      sku: variant.sku,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      unitPrice: product.salePrice ?? product.price,
      quantity: item.quantity,
      stockAvailable: variant.stock,
    });
  }
  const staleSkus = cart.items.filter((item) => !enriched.some((current) => current.sku === item.sku));
  if (staleSkus.length) {
    cart.items = cart.items.filter((item) => !staleSkus.some((stale) => stale.sku === item.sku));
    await cart.save();
  }
  return {
    items: enriched,
    subtotal: enriched.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  };
}

export async function setCartItem(userId, { productId, sku, quantity }) {
  const cart = await getOrCreateCart(userId);
  const index = cart.items.findIndex((item) => item.sku === sku);
  if (quantity === 0) {
    if (index >= 0) cart.items.splice(index, 1);
    await cart.save();
    return readCart(userId);
  }
  const product = await Product.findOne({ _id: productId, isActive: true, 'variants.sku': sku });
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product or variant not found');
  const variant = product.variants.find((item) => item.sku === sku);
  if (!variant || quantity > variant.stock) {
    throw new ApiError(409, 'OUT_OF_STOCK', 'Requested quantity exceeds available stock');
  }
  if (index >= 0) {
    cart.items[index].productId = productId;
    cart.items[index].quantity = quantity;
  } else {
    cart.items.push({ productId, sku, quantity });
  }
  await cart.save();
  return readCart(userId);
}

export async function emptyCart(userId) {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  await cart.save();
  return { items: [], subtotal: 0 };
}
