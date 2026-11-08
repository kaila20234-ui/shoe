import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { customerRoutes } from './customer/routes';
import { adminRoutes } from './admin/routes';
import { ownerRoutes } from './owner/routes';
import { AdminLayout, OwnerLayout } from './shared/layout';
import { RequireAuth } from './shared/auth/guards';
import { EmptyState } from './shared/ui';

const adminChildren: RouteObject[] = adminRoutes.map((route) => {
  const routePath = route.path?.replace(/^\/admin\/?/, '') ?? '';
  if (!routePath) return { index: true, element: route.element };
  return { ...route, path: routePath };
});

export const router = createBrowserRouter([
  ...customerRoutes,
  {
    path: '/admin',
    element: <RequireAuth roles={['admin']}><AdminLayout /></RequireAuth>,
    children: adminChildren,
  },
  {
    path: '/owner',
    element: <RequireAuth roles={['owner', 'admin']}><OwnerLayout /></RequireAuth>,
    children: ownerRoutes,
  },
  { path: '*', element: <div className="shared-page"><EmptyState title="Page not found." /></div> },
]);
