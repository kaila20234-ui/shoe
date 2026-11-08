import { Product, User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';

export async function listWishlist(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return Product.find({ _id: { $in: user.wishlist }, isActive: true });
}

export async function addWishlistItem(userId, productId) {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { wishlist: String(product.id) } },
    { new: true },
  );
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return user.wishlist.map(String);
}

export async function removeWishlistItem(userId, productId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { wishlist: productId } },
    { new: true },
  );
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return user.wishlist.map(String);
}
