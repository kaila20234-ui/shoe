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

export const adminRoutes: RouteObject[] = [
  { path: '/admin', element: <DashboardPage /> },
  { path: '/admin/products', element: <ProductsPage /> },
  { path: '/admin/products/new', element: <ProductEditorPage /> },
  { path: '/admin/products/:id', element: <ProductEditorPage /> },
  { path: '/admin/orders', element: <OrdersPage /> },
  { path: '/admin/orders/:id', element: <OrderDetailPage /> },
  { path: '/admin/customers', element: <CustomersPage /> },
  { path: '/admin/inventory', element: <InventoryPage /> },
  { path: '/admin/discounts', element: <DiscountsPage /> },
  { path: '/admin/delivery', element: <DeliveryPage /> },
  { path: '/admin/reviews', element: <ReviewsPage /> },
  { path: '/admin/returns', element: <ReturnsPage /> },
  { path: '/admin/audit-logs', element: <AuditLogsPage /> }
];
