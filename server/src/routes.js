import express from 'express';
import { authenticate, authorize } from './middleware/auth.js';
import authRouter from './modules/auth/auth.routes.js';
import usersRouter from './modules/users/users.routes.js';
import productsRouter from './modules/products/products.routes.js';
import reviewsRouter from './modules/reviews/reviews.routes.js';
import cartRouter from './modules/cart/cart.routes.js';
import wishlistRouter from './modules/wishlist/wishlist.routes.js';
import checkoutRouter from './modules/checkout/checkout.routes.js';
import ordersRouter from './modules/orders/orders.routes.js';
import paymentsRouter from './modules/payments/payments.routes.js';
import deliveryRouter from './modules/delivery/delivery.routes.js';
import discountsRouter from './modules/discounts/discounts.routes.js';
import returnsRouter from './modules/returns/returns.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import ownerRouter from './modules/owner/owner.routes.js';

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/admin', authenticate, authorize('admin'));
router.use('/owner', authenticate, authorize('owner', 'admin'));
router.use('/audit-logs', authenticate, authorize('owner', 'admin'));

router.use('/auth', authRouter);
router.use('/', usersRouter);
router.use('/admin', adminRouter);

router.use('/products', productsRouter);
router.use('/products', reviewsRouter);
router.use('/cart', authenticate, authorize('customer'), cartRouter);
router.use('/wishlist', authenticate, authorize('customer'), wishlistRouter);
router.use('/checkout', authenticate, authorize('customer'), checkoutRouter);
router.use('/orders', authenticate, authorize('customer'), ordersRouter);
router.use('/payments', paymentsRouter);
router.use('/delivery-zones', deliveryRouter);
router.use('/discounts', authenticate, authorize('customer'), discountsRouter);
router.use('/returns', authenticate, authorize('customer'), returnsRouter);
router.use('/owner', ownerRouter);
router.use('/audit-logs', ownerRouter);

export default router;
