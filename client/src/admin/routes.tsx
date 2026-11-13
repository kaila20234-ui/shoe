import type { RouteObject } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductEditorPage } from './pages/ProductEditorPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersPage } from './pages/CustomersPage';
import { InventoryPage } from './pages/InventoryPage';
import { DiscountsPage } from './pages/DiscountsPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

export const adminRoutes: RouteObject[] = [
  { index: true, element: <DashboardPage /> },
  { path: 'products', element: <ProductsPage /> },
  { path: 'products/new', element: <ProductEditorPage /> },
  { path: 'products/:id', element: <ProductEditorPage /> },
  { path: 'orders', element: <OrdersPage /> },
  { path: 'orders/:id', element: <OrderDetailPage /> },
  { path: 'customers', element: <CustomersPage /> },
  { path: 'team', element: <AdminUsersPage /> },
  { path: 'inventory', element: <InventoryPage /> },
  { path: 'discounts', element: <DiscountsPage /> },
  { path: 'delivery', element: <DeliveryPage /> },
  { path: 'reviews', element: <ReviewsPage /> },
  { path: 'returns', element: <ReturnsPage /> },
  { path: 'audit-logs', element: <AuditLogsPage /> },
];
