import mongoose from 'mongoose';

const { Schema } = mongoose;

function jsonTransform(_doc, value) {
  value.id = String(value._id);
  delete value._id;
  delete value.__v;
  delete value.passwordHash;
  delete value.resetPasswordTokenHash;
  delete value.resetPasswordExpiresAt;
  return value;
}

function createSchema(definition, options = {}) {
  const schema = new Schema(definition, {
    timestamps: true,
    ...options,
  });
  schema.set('toJSON', { transform: jsonTransform });
  return schema;
}

const addressSchema = new Schema(
  {
    id: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
    label: { type: String, required: true, trim: true },
    recipient: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    isDefault: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const userSchema = createSchema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, trim: true },
  role: { type: String, enum: ['customer', 'admin', 'owner'], required: true, default: 'customer' },
  isActive: { type: Boolean, required: true, default: true },
  addresses: { type: [addressSchema], default: [] },
  wishlist: { type: [String], default: [] },
  resetPasswordTokenHash: { type: String, select: false },
  resetPasswordExpiresAt: { type: Date, select: false },
});

const productVariantSchema = new Schema(
  {
    sku: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    color: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const productSchema = createSchema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  description: { type: String, required: true },
  brand: { type: String, required: true, trim: true },
  audience: { type: String, enum: ['men', 'women', 'kids'], required: true },
  type: { type: String, enum: ['sneakers', 'formal', 'sandals', 'boots', 'sports'], required: true },
  price: { type: Number, required: true, min: 0 },
  salePrice: {
    type: Number,
    min: 0,
    validate: {
      validator(value) {
        return value == null || value < this.price;
      },
      message: 'salePrice must be lower than price',
    },
  },
  images: { type: [String], required: true, default: [] },
  variants: { type: [productVariantSchema], required: true, default: [] },
  isActive: { type: Boolean, required: true, default: true },
  ratingAverage: { type: Number, required: true, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, required: true, min: 0, default: 0 },
});
productSchema.index({ 'variants.sku': 1 }, { unique: true });
productSchema.index({ name: 'text', brand: 'text' });

const cartItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    sku: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema = createSchema(
  {
    userId: { type: String, required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: false },
);

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    size: { type: Number, required: true },
    color: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);
const shippingAddressSchema = new Schema(
  {
    recipient: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    landmark: String,
  },
  { _id: false },
);
const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'],
      required: true,
    },
    note: String,
    at: { type: Date, required: true, default: Date.now },
    byUserId: String,
  },
  { _id: false },
);

const orderSchema = createSchema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  customerId: { type: String, required: true },
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
  },
  statusHistory: { type: [statusHistorySchema], required: true, default: [] },
});

const transactionSchema = createSchema({
  reference: { type: String, required: true, unique: true, trim: true },
  orderId: { type: String, required: true },
  orderNumber: { type: String, required: true },
  customerId: { type: String, required: true },
  customerName: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['paystack', 'pay_on_delivery'], required: true },
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], required: true },
});

const discountSchema = createSchema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 1 },
  minSubtotal: { type: Number, required: true, min: 0, default: 0 },
  maxUses: { type: Number, min: 1 },
  usedCount: { type: Number, required: true, min: 0, default: 0 },
  expiresAt: Date,
  isActive: { type: Boolean, required: true, default: true },
}, { timestamps: false });

const deliveryZoneSchema = createSchema({
  name: { type: String, required: true, trim: true },
  states: { type: [String], required: true, default: [] },
  fee: { type: Number, required: true, min: 0 },
  estimatedDays: { type: String, required: true },
  isActive: { type: Boolean, required: true, default: true },
}, { timestamps: false });

const reviewSchema = createSchema({
  productId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true, default: 'pending' },
}, { timestamps: { createdAt: true, updatedAt: false } });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

const returnItemSchema = new Schema(
  {
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);
const returnRequestSchema = createSchema({
  orderId: { type: String, required: true },
  orderNumber: { type: String, required: true },
  customerId: { type: String, required: true },
  items: { type: [returnItemSchema], required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'refunded'], required: true, default: 'requested' },
  adminNote: String,
});

const auditLogSchema = createSchema({
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, enum: ['customer', 'admin', 'owner'], required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },
  meta: { type: Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } });

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

export default {
  User,
  Product,
  Cart,
  Order,
  Transaction,
  Discount,
  DeliveryZone,
  Review,
  ReturnRequest,
  AuditLog,
};
