import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Spinner } from '../shared/ui';

const OwnerOverviewPage = lazy(() => import('./pages/OwnerOverviewPage').then((module) => ({ default: module.OwnerOverviewPage })));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })));
const TransactionDetailPage = lazy(() => import('./pages/TransactionDetailPage').then((module) => ({ default: module.TransactionDetailPage })));
const OwnerReportsPage = lazy(() => import('./pages/OwnerReportsPage').then((module) => ({ default: module.OwnerReportsPage })));

function PageLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner label="Loading owner portal" />}>{children}</Suspense>;
}

export const ownerRoutes: RouteObject[] = [
  { index: true, element: <PageLoader><OwnerOverviewPage /></PageLoader> },
  { path: 'transactions', element: <PageLoader><TransactionsPage /></PageLoader> },
  { path: 'transactions/:id', element: <PageLoader><TransactionDetailPage /></PageLoader> },
  { path: 'reports', element: <PageLoader><OwnerReportsPage /></PageLoader> },
];
