import { createBrowserRouter } from 'react-router-dom';
import { customerRoutes } from './customer/routes';
import { adminRoutes } from './admin/routes';
import { ownerRoutes } from './owner/routes';
import { AdminLayout, OwnerLayout } from './shared/layout';
import { RequireAuth } from './shared/auth/guards';
import { EmptyState } from './shared/ui';
import { AdminDataStoreProvider } from './admin/components/AdminDataStore';
import { AdminLoginPage } from './admin/pages/AdminLoginPage';

export const router = createBrowserRouter([
  ...customerRoutes,
  { path: '/admin/login', element: <AdminLoginPage /> },
  {
    path: '/admin',
    element: <RequireAuth roles={['admin']}><AdminDataStoreProvider><AdminLayout /></AdminDataStoreProvider></RequireAuth>,
    children: adminRoutes,
  },
  {
    path: '/owner',
    element: <RequireAuth roles={['owner', 'admin']}><OwnerLayout /></RequireAuth>,
    children: ownerRoutes,
  },
  { path: '*', element: <div className="shared-page"><EmptyState title="Page not found." /></div> },
]);
