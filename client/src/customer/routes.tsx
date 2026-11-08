import type { RouteObject } from 'react-router-dom';
import { CustomerLayout } from '../shared/layout';
import { EmptyState } from '../shared/ui';

export const customerRoutes: RouteObject[] = [
  {
    path: '/',
    element: <CustomerLayout />,
    children: [
      { index: true, element: <div className="shared-page"><EmptyState title="Storefront is being set up." /></div> },
    ],
  },
];
