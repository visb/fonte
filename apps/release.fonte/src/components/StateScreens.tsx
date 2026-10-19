import type { ReactNode } from 'react';

export function LoadingState({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="card center" role="status">
      <p>{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message?: string;
  children?: ReactNode;
}

export function EmptyState({ title, message, children }: EmptyStateProps) {
  return (
    <div className="card center">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {children}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="card center" role="alert">
      <h2>Algo deu errado</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="secondary" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
