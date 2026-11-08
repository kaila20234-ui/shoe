import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './shared/auth/AuthContext';
import { ToastProvider } from './shared/ui';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider><RouterProvider router={router} /></ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
