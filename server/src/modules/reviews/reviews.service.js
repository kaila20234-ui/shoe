import { Order, Product, Review } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';

export async function listApprovedReviews(productId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { productId, status: 'approved' };
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function createReview(user, productId, input) {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  const order = await Order.findOne({
    customerId: String(user.id),
    status: 'delivered',
    'items.productId': String(product.id),
  });
  if (!order) throw new ApiError(403, 'FORBIDDEN', 'A delivered order containing this product is required');
  if (await Review.exists({ productId: String(product.id), userId: String(user.id) })) {
    throw new ApiError(409, 'CONFLICT', 'You have already reviewed this product');
  }
  return Review.create({
    productId: String(product.id),
    userId: String(user.id),
    userName: user.name,
    rating: input.rating,
    comment: input.comment,
    status: 'pending',
  });
}

export async function listForModeration(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function moderateReview(id, status) {
  const review = await Review.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status } },
    { new: true },
  );
  if (!review) {
    if (!await Review.exists({ _id: id })) throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    throw new ApiError(409, 'CONFLICT', 'Review has already been moderated');
  }
  if (status === 'approved') {
    const approved = await Review.find({ productId: review.productId, status: 'approved' });
    const ratingCount = approved.length;
    const ratingAverage = ratingCount
      ? Math.round(approved.reduce((sum, item) => sum + item.rating, 0) / ratingCount * 10) / 10
      : 0;
    await Product.updateOne(
      { _id: review.productId },
      { $set: { ratingAverage, ratingCount } },
    );
  }
  return review;
}
