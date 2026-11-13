import mongoose from 'mongoose';

function documentTransform(_document, value) {
  if (value._id !== undefined) value.id = String(value._id);
  delete value._id;
  delete value.__v;
  delete value.passwordHash;
  delete value.resetPasswordTokenHash;
  delete value.resetPasswordExpiresAt;
  return value;
}

const documentOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: { transform: documentTransform },
  toObject: { transform: documentTransform },
};

const addressSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  label: { type: String, required: true },
  recipient: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  landmark: String,
  isDefault: { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: String,
  avatarUrl: String,
  role: { type: String, enum: ['customer', 'admin', 'owner'], default: 'customer', required: true },
  isActive: { type: Boolean, default: true },
  addresses: { type: [addressSchema], default: [] },
  wishlist: { type: [String], default: [] },
  resetPasswordTokenHash: String,
  resetPasswordExpiresAt: Date,
}, documentOptions);

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, trim: true },
  size: { type: Number, required: true, min: 1 },
  color: { type: String, required: true, trim: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  description: { type: String, required: true },
  brand: { type: String, required: true, trim: true },
  audience: { type: String, enum: ['men', 'women', 'kids'], required: true },
  type: { type: String, enum: ['sneakers', 'formal', 'sandals', 'boots', 'sports'], required: true },
  price: { type: Number, required: true, min: 1 },
  salePrice: { type: Number, min: 1 },
  images: { type: [String], required: true, validate: (items) => items.length > 0 },
  variants: { type: [variantSchema], required: true, validate: (items) => items.length > 0 },
  isActive: { type: Boolean, default: true },
  ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, min: 0, default: 0 },
}, documentOptions);
productSchema.index({ 'variants.sku': 1 }, { unique: true });

const cartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  items: { type: [cartItemSchema], default: [] },
}, { ...documentOptions, timestamps: false });

const deliveryZoneSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  states: { type: [String], required: true },
  fee: { type: Number, required: true, min: 0 },
  estimatedDays: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { ...documentOptions, timestamps: false });

const discountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 1 },
  minSubtotal: { type: Number, required: true, min: 0, default: 0 },
  maxUses: { type: Number, min: 1 },
  usedCount: { type: Number, min: 0, default: 0 },
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
}, { ...documentOptions, timestamps: false });

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  size: { type: Number, required: true },
  color: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  landmark: String,
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'],
    required: true,
  },
  note: String,
  at: { type: Date, required: true },
  byUserId: String,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customerId: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  items: { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  discountCode: String,
  discountAmount: { type: Number, required: true, min: 0, default: 0 },
  deliveryFee: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  shippingAddress: { type: shippingAddressSchema, required: true },
  deliveryZoneId: { type: String, required: true },
  paymentMethod: { type: String, enum: ['paystack', 'pay_on_delivery'], required: true },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed', 'refunded'], required: true },
  status: {
    type: String,
    enum: ['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'],
    required: true,
    index: true,
  },
  statusHistory: { type: [statusHistorySchema], default: [] },
}, documentOptions);

const transactionSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  orderId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true },
  customerId: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['paystack', 'pay_on_delivery'], required: true },
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], required: true },
}, documentOptions);

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
}, { ...documentOptions, timestamps: { createdAt: true, updatedAt: false } });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

const returnItemSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const returnRequestSchema = new mongoose.Schema({
  orderId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true },
  customerId: { type: String, required: true, index: true },
  items: { type: [returnItemSchema], required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'refunded'], default: 'requested', required: true },
  adminNote: String,
}, documentOptions);

const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, enum: ['customer', 'admin', 'owner'], required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },
  meta: mongoose.Schema.Types.Mixed,
}, { ...documentOptions, timestamps: { createdAt: true, updatedAt: false } });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export const Discount = mongoose.models.Discount || mongoose.model('Discount', discountSchema);
export const DeliveryZone = mongoose.models.DeliveryZone || mongoose.model('DeliveryZone', deliveryZoneSchema);
export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
export const ReturnRequest = mongoose.models.ReturnRequest || mongoose.model('ReturnRequest', returnRequestSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
