import { Navigate, type RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CustomerLayout } from '../shared/layout/CustomerLayout';
import { RequireAuth } from '../shared/auth/guards';
import './customer.css';
import {
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
import {
  AccountAddressesPage,
  AccountLayout,
  AccountProfilePage,
  AccountSecurityPage,
} from './account';

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
      { path: 'checkout/verify', element: <VerifyPaymentPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'orders', element: customerOnly(<OrdersPage />) },
      { path: 'orders/:id', element: customerOnly(<OrderDetailPage />) },
      { path: 'wishlist', element: customerOnly(<WishlistPage />) },
      {
        path: 'account',
        element: customerOnly(<AccountLayout />),
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <AccountProfilePage /> },
          { path: 'addresses', element: <AccountAddressesPage /> },
          { path: 'security', element: <AccountSecurityPage /> },
        ],
      },
    ],
  },
];
