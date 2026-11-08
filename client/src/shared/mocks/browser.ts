import { setupWorker } from 'msw/browser';
import type { RequestHandler } from 'msw';

const mockModules = import.meta.glob<{ handlers?: RequestHandler[] }>(
  '/src/{customer,admin,owner}/mocks/index.ts',
  { eager: true },
);

export async function startMocks(): Promise<void> {
  const handlers = Object.values(mockModules).flatMap((module) => module.handlers ?? []);
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass' });
}
