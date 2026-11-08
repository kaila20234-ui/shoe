import type { RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CustomerLayout } from '../shared/layout/CustomerLayout';
import { RequireAuth } from '../shared/auth/guards';
import './customer.css';
import {
  AccountPage,
  CartPage,
  CheckoutPage,
  ForgotPasswordPage,
  HomePage,
  LoginPage,
  OrderDetailPage,
  OrdersPage,
  ProductPage,
  RegisterPage,
  ResetPasswordPage,
  ShopPage,
  VerifyPaymentPage,
  WishlistPage,
} from './pages';

const customerOnly = (element: ReactNode) => (
  <RequireAuth roles={['customer']}>{element}</RequireAuth>
);

export const customerRoutes: RouteObject[] = [
  {
    path: '/',
    element: <CustomerLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'checkout/verify', element: customerOnly(<VerifyPaymentPage />) },
      { path: 'cart', element: customerOnly(<CartPage />) },
      { path: 'checkout', element: customerOnly(<CheckoutPage />) },
      { path: 'orders', element: customerOnly(<OrdersPage />) },
      { path: 'orders/:id', element: customerOnly(<OrderDetailPage />) },
      { path: 'wishlist', element: customerOnly(<WishlistPage />) },
      { path: 'account', element: customerOnly(<AccountPage />) },
    ],
  },
];
