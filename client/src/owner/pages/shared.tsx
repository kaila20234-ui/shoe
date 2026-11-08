import type { ReactNode } from 'react';
import { ApiClientError } from '../../shared/api/client';
import { Button, Spinner } from '../../shared/ui';

export function PageHeading({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="shared-heading"><div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}

export function QueryError({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof ApiClientError ? error.message : 'Unable to load this information.';
  return (
    <div className="shared-error" role="alert">
      <span>{message}</span>
      {retry && <Button className="no-print" variant="secondary" onClick={retry}>Try again</Button>}
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return <Spinner label={label ?? 'Loading report'} />;
}
