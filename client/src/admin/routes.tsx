import type { RouteObject } from 'react-router-dom';
import { EmptyState } from '../shared/ui';

export const adminRoutes: RouteObject[] = [
  { path: '/admin', element: <div className="shared-page"><EmptyState title="Admin dashboard is being set up." /></div> },
];
