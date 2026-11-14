import { ApiClientError } from '../shared/api/client';
import type { Cart, CartItem, Product } from '../shared/types';
import { customerApi } from './api';

export interface GuestCartEntry {
  productId: string;
  sku: string;
  quantity: number;
}

const storageKey = 'shoe-store-guest-cart-v1';

export function cartQueryKey(userId?: string) {
  return ['cart', userId ?? 'guest'] as const;
}

function isGuestCartEntry(value: unknown): value is GuestCartEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<GuestCartEntry>;
  return typeof entry.productId === 'string'
    && typeof entry.sku === 'string'
    && Number.isInteger(entry.quantity)
    && Number(entry.quantity) > 0;
}

export function readGuestCartEntries(): GuestCartEntry[] {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error('Could not read the saved guest cart; clearing invalid data.', error);
    window.localStorage.removeItem(storageKey);
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error('Could not read the saved guest cart; clearing invalid data.');
    window.localStorage.removeItem(storageKey);
    return [];
  }
  const entries = parsed.filter(isGuestCartEntry);
  if (entries.length !== parsed.length) {
    console.warn('Invalid entries were removed from the guest cart.');
    saveGuestCartEntries(entries);
  }
  return entries;
}

export function saveGuestCartEntries(entries: GuestCartEntry[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(entries));
}

export function clearGuestCart() {
  window.localStorage.removeItem(storageKey);
}

function cartFromItems(items: CartItem[]): Cart {
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  };
}

async function findGuestProduct(entry: GuestCartEntry): Promise<Product | undefined> {
  try {
    return await customerApi.product(entry.productId);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return undefined;
    throw error;
  }
}

export async function loadGuestCart(): Promise<Cart> {
  const entries = readGuestCartEntries();
  const resolved = await Promise.all(entries.map(async (entry) => {
    const product = await findGuestProduct(entry);
    const variant = product?.variants.find((item) => item.sku === entry.sku);
    if (!product || !variant) return undefined;
    const item: CartItem = {
      productId: product.id,
      sku: variant.sku,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      unitPrice: product.salePrice ?? product.price,
      quantity: entry.quantity,
      stockAvailable: variant.stock,
    };
    return { entry, item };
  }));
  const valid = resolved.filter((value): value is NonNullable<typeof value> => !!value);
  if (valid.length !== entries.length) {
    console.warn('Unavailable products were removed from the guest cart.');
    saveGuestCartEntries(valid.map(({ entry }) => entry));
  }
  return cartFromItems(valid.map(({ item }) => item));
}

export async function setGuestCartItem(productId: string, sku: string, quantity: number): Promise<Cart> {
  const currentCart = await loadGuestCart();
  const entries = readGuestCartEntries();
  const index = entries.findIndex((entry) => entry.sku === sku);
  if (quantity === 0) {
    if (index >= 0) entries.splice(index, 1);
    saveGuestCartEntries(entries);
    return cartFromItems(currentCart.items.filter((item) => item.sku !== sku));
  }
  const product = await customerApi.product(productId);
  const variant = product.variants.find((item) => item.sku === sku);
  if (!variant) throw new Error('This size is no longer available.');
  if (quantity > variant.stock) throw new Error(`Only ${variant.stock} available for this size.`);
  if (quantity > 100) throw new Error('You can add up to 100 of this size.');
  const entry = { productId: product.id, sku, quantity };
  if (index >= 0) entries[index] = entry;
  else entries.push(entry);
  saveGuestCartEntries(entries);
  const item: CartItem = {
    productId: product.id,
    sku: variant.sku,
    name: product.name,
    image: product.images[0],
    size: variant.size,
    color: variant.color,
    unitPrice: product.salePrice ?? product.price,
    quantity,
    stockAvailable: variant.stock,
  };
  return cartFromItems([...currentCart.items.filter((current) => current.sku !== sku), item]);
}

export async function addGuestCartItem(productId: string, sku: string): Promise<Cart> {
  const quantity = (readGuestCartEntries().find((entry) => entry.sku === sku)?.quantity ?? 0) + 1;
  return setGuestCartItem(productId, sku, quantity);
}

export async function loadCart(userId?: string): Promise<Cart> {
  if (!userId) return loadGuestCart();
  let cart = await customerApi.cart();
  const entries = readGuestCartEntries();
  for (const entry of entries) {
    const product = await findGuestProduct(entry);
    const variant = product?.variants.find((item) => item.sku === entry.sku);
    if (!product || !variant) continue;
    const existingQuantity = cart.items.find((item) => item.sku === entry.sku)?.quantity ?? 0;
    const quantity = Math.min(variant.stock, existingQuantity + entry.quantity);
    if (quantity !== existingQuantity) {
      cart = await customerApi.setCartItem(product.id, entry.sku, quantity);
    }
  }
  if (entries.length) clearGuestCart();
  return cart;
}
