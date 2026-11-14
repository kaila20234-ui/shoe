import mongoose from 'mongoose';
import { Product } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listProducts(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { isActive: true };
  if (query.q) {
    const text = escapeRegex(query.q.trim());
    filter.$or = [{ name: new RegExp(text, 'i') }, { brand: new RegExp(text, 'i') }];
  }
  for (const key of ['audience', 'type']) if (query[key]) filter[key] = query[key];
  if (query.brand) filter.brand = query.brand;
  const variantFilter = {};
  if (query.size !== undefined) variantFilter.size = query.size;
  if (query.color) variantFilter.color = new RegExp(`^${escapeRegex(query.color)}$`, 'i');
  if (Object.keys(variantFilter).length) filter.variants = { $elemMatch: variantFilter };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const effectivePrice = { $ifNull: ['$salePrice', '$price'] };
    const priceConditions = [];
    if (query.minPrice !== undefined) priceConditions.push({ $gte: [effectivePrice, query.minPrice] });
    if (query.maxPrice !== undefined) priceConditions.push({ $lte: [effectivePrice, query.maxPrice] });
    filter.$expr = { $and: priceConditions };
  }
  const sort = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    rating: { ratingAverage: -1, ratingCount: -1 },
  }[query.sort];
  const [items, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getProduct(idOrSlug, includeInactive = false) {
  const filter = mongoose.Types.ObjectId.isValid(idOrSlug)
    ? { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] }
    : { slug: idOrSlug };
  if (!includeInactive) filter.isActive = true;
  const product = await Product.findOne(filter);
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  return product;
}

export async function getProductFilters() {
  const products = await Product.find({ isActive: true }, 'brand audience type price variants.size variants.color');
  const brands = new Set();
  const colors = new Set();
  const sizes = new Set();
  const audiences = new Set();
  const types = new Set();
  let min = Infinity;
  let max = 0;
  for (const product of products) {
    brands.add(product.brand);
    audiences.add(product.audience);
    types.add(product.type);
    min = Math.min(min, product.salePrice ?? product.price);
    max = Math.max(max, product.salePrice ?? product.price);
    for (const variant of product.variants) {
      colors.add(variant.color);
      sizes.add(variant.size);
    }
  }
  return {
    brands: [...brands].sort(),
    colors: [...colors].sort(),
    sizes: [...sizes].sort((a, b) => a - b),
    audiences: [...audiences].sort(),
    types: [...types].sort(),
    priceRange: { min: Number.isFinite(min) ? min : 0, max },
  };
}

export async function listAdminProducts(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.q) {
    const text = escapeRegex(query.q.trim());
    filter.$or = [{ name: new RegExp(text, 'i') }, { brand: new RegExp(text, 'i') }];
  }
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export function slugFromName(name) {
  return name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
}

async function uniqueSlug(name, excludeId) {
  const base = slugFromName(name);
  let slug = base;
  for (let suffix = 2; await Product.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); suffix += 1) {
    slug = `${base}-${suffix}`;
  }
  return slug;
}

export async function createProduct(input) {
  if (input.salePrice !== undefined && input.salePrice >= input.price) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'salePrice must be below price');
  }
  const { modelUrl, ...fields } = input;
  return Product.create({
    ...fields,
    ...(modelUrl ? { modelUrl } : {}),
    slug: await uniqueSlug(input.name),
    ratingAverage: 0,
    ratingCount: 0,
  });
}

export async function updateProduct(id, input) {
  const product = await getProduct(id, true);
  const nextPrice = input.price ?? product.price;
  const nextSalePrice = input.salePrice === undefined ? product.salePrice : input.salePrice;
  if (nextSalePrice !== undefined && nextSalePrice >= nextPrice) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'salePrice must be below price');
  }
  if (input.variants) {
    const existing = new Set(input.variants.map(({ sku }) => sku));
    if (existing.size !== input.variants.length) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Variant SKUs must be unique');
    }
  }
  const { modelUrl, ...fields } = input;
  Object.assign(product, fields);
  if (modelUrl === null) product.modelUrl = undefined;
  else if (modelUrl !== undefined) product.modelUrl = modelUrl;
  if (input.name) product.slug = await uniqueSlug(input.name, product.id);
  await product.save();
  return product;
}

export async function setStock(id, sku, stock) {
  const result = await Product.findOneAndUpdate(
    { _id: id, 'variants.sku': sku },
    { $set: { 'variants.$.stock': stock } },
    { new: true, runValidators: true },
  );
  if (!result) throw new ApiError(404, 'NOT_FOUND', 'Product variant not found');
  return result;
}

export async function lowStock(threshold) {
  const products = await Product.find({ isActive: true, 'variants.stock': { $lte: threshold } });
  return products.flatMap((product) => product.variants
    .filter((variant) => variant.stock <= threshold)
    .map((variant) => ({
      productId: String(product.id),
      name: product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
    })));
}
