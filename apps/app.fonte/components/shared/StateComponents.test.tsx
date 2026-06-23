import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

describe('EmptyState', () => {
  it('mostra a mensagem padrão', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nenhum item encontrado.')).toBeOnTheScreen();
  });

  it('mostra mensagem custom e ícone', () => {
    render(<EmptyState message="Sem mensagens" icon={<Text>📭</Text>} />);
    expect(screen.getByText('Sem mensagens')).toBeOnTheScreen();
    expect(screen.getByText('📭')).toBeOnTheScreen();
  });
});

describe('ErrorState', () => {
  it('mostra a mensagem padrão e oculta o botão sem onRetry', () => {
    render(<ErrorState />);
    expect(screen.getByText('Erro ao carregar dados.')).toBeOnTheScreen();
    expect(screen.queryByText('Tentar novamente')).toBeNull();
  });

  it('mostra o botão e dispara onRetry', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Falhou" onRetry={onRetry} />);
    expect(screen.getByText('Falhou')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('LoadingState', () => {
  it('mostra o spinner sem mensagem por padrão', () => {
    render(<LoadingState />);
    expect(screen.queryByText('Carregando')).toBeNull();
  });

  it('mostra a mensagem quando informada', () => {
    render(<LoadingState message="Carregando..." />);
    expect(screen.getByText('Carregando...')).toBeOnTheScreen();
  });
});
