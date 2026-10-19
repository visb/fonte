import { render, screen } from '@testing-library/react';
import { EmptyState, ErrorState, LoadingState } from './StateScreens';

describe('StateScreens', () => {
  it('LoadingState usa mensagem padrão', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando...');
  });

  it('EmptyState aceita conteúdo extra e dispensa mensagem', () => {
    render(
      <EmptyState title="Vazio">
        <span>extra</span>
      </EmptyState>,
    );
    expect(screen.getByText('Vazio')).toBeInTheDocument();
    expect(screen.getByText('extra')).toBeInTheDocument();
  });

  it('ErrorState sem onRetry não mostra botão', () => {
    render(<ErrorState message="falhou" />);
    expect(screen.getByRole('alert')).toHaveTextContent('falhou');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
