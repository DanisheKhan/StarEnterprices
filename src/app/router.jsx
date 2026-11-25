import { createBrowserRouter, Navigate, Link } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { AdminConsoleLayout } from './layouts/AdminConsoleLayout';
import { Button, RouteErrorBoundary } from '@/shared/ui';
import { lazyWithRetry } from '@/shared/lib/lazyWithRetry';

const PublicHomePage = lazyWithRetry(() => import('@/features/catalog').then((m) => ({ default: m.PublicHomePage })));
const LoginPage = lazyWithRetry(() => import('@/features/auth').then((m) => ({ default: m.LoginPage })));
const LauncherPage = lazyWithRetry(() => import('@/features/launcher').then((m) => ({ default: m.LauncherPage })));
const StoreDashboardPage = lazyWithRetry(() => import('@/features/launcher').then((m) => ({ default: m.StoreDashboardPage })));
const ReportsConsolePage = lazyWithRetry(() => import('@/features/reports').then((m) => ({ default: m.ReportsConsolePage })));
const StaffManagementPage = lazyWithRetry(() => import('@/features/staff').then((m) => ({ default: m.StaffManagementPage })));
const POSPage = lazyWithRetry(() => import('@/features/billing').then((m) => ({ default: m.POSPage })));
const InvoicesListPage = lazyWithRetry(() => import('@/features/billing').then((m) => ({ default: m.InvoicesListPage })));
const InventoryCardsPage = lazyWithRetry(() => import('@/features/inventory').then((m) => ({ default: m.InventoryCardsPage })));
const SerialNumbersPage = lazyWithRetry(() => import('@/features/inventory').then((m) => ({ default: m.SerialNumbersPage })));
const SecondHandIntakePage = lazyWithRetry(() => import('@/features/second-hand').then((m) => ({ default: m.SecondHandIntakePage })));
const DealersHubPage = lazyWithRetry(() => import('@/features/dealers').then((m) => ({ default: m.DealersHubPage })));
const DealerKhataPage = lazyWithRetry(() => import('@/features/dealers').then((m) => ({ default: m.DealerKhataPage })));
const PurchaseBillingPage = lazyWithRetry(() => import('@/features/dealers').then((m) => ({ default: m.PurchaseBillingPage })));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <PublicHomePage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'star-enterprises',
        element: <Navigate to="/" replace />,
      },
    ],
  },
  {
    path: 'admin',
    element: <AdminConsoleLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <LauncherPage />,
      },
      {
        path: 'staff',
        element: <StaffManagementPage />,
      },
      {
        path: 'reports',
        element: <ReportsConsolePage />,
      },
      {
        path: 'dealers',
        element: <DealersHubPage />,
      },
      {
        path: 'dealers/billing',
        element: <PurchaseBillingPage />,
      },
      {
        path: 'dealers/:dealerId',
        element: <DealerKhataPage />,
      },
      {
        path: 'invoices',
        element: <InvoicesListPage />,
      },
      {
        path: ':storeCode',
        element: <StoreDashboardPage />,
      },
      {
        path: ':storeCode/dashboard',
        element: <Navigate to=".." relative="path" replace />,
      },
      {
        path: ':storeCode/billing',
        element: <POSPage />,
      },
      {
        path: ':storeCode/invoices',
        element: <InvoicesListPage />,
      },
      {
        path: ':storeCode/inventory',
        element: <InventoryCardsPage />,
      },
      {
        path: ':storeCode/serials',
        element: <SerialNumbersPage />,
      },
      {
        path: ':storeCode/dealers',
        element: <DealersHubPage />,
      },
      {
        path: ':storeCode/dealers/billing',
        element: <PurchaseBillingPage />,
      },
      {
        path: ':storeCode/dealers/:dealerId',
        element: <DealerKhataPage />,
      },
      {
        path: ':storeCode/second-hand',
        element: <SecondHandIntakePage />,
      },
      {
        path: ':storeCode/reports',
        element: <ReportsConsolePage />,
      },
    ],
  },
  {
    path: '*',
    element: (
      <div className="min-h-dvh bg-bg text-text flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-2xs space-y-4">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
            404 • Not Found
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            This page doesn&apos;t exist
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            It may have been moved, removed, or the URL may be incorrect.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Button as={Link} to="/" variant="solid" size="sm">
              Go to Storefront
            </Button>
            <Button as={Link} to="/admin" variant="outline" size="sm">
              Admin Console
            </Button>
          </div>
        </div>
      </div>
    ),
  },
]);
