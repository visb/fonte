import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PasswordInput } from './PasswordInput';

afterEach(() => cleanup());

describe('PasswordInput (story 173)', () => {
  it('renderiza oculto por padrão, com o botão oferecendo "Mostrar senha"', () => {
    render(<PasswordInput aria-label="Senha" />);
    expect((screen.getByLabelText('Senha') as HTMLInputElement).type).toBe('password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument();
  });

  it('clicar em "Mostrar senha" revela o texto e inverte o rótulo do botão', () => {
    render(<PasswordInput aria-label="Senha" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect((screen.getByLabelText('Senha') as HTMLInputElement).type).toBe('text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument();
  });

  it('segundo clique volta a ocultar', () => {
    render(<PasswordInput aria-label="Senha" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));

    expect((screen.getByLabelText('Senha') as HTMLInputElement).type).toBe('password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument();
  });

  it('duas instâncias na mesma tela têm estado independente', () => {
    render(
      <>
        <PasswordInput aria-label="Nova senha" />
        <PasswordInput aria-label="Confirmar senha" />
      </>,
    );

    // Revela só a primeira.
    fireEvent.click(screen.getAllByRole('button', { name: 'Mostrar senha' })[0]);

    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).type).toBe('text');
    expect((screen.getByLabelText('Confirmar senha') as HTMLInputElement).type).toBe('password');
  });

  it('o valor digitado sobrevive ao toggle', () => {
    render(<PasswordInput aria-label="Senha" />);
    const input = screen.getByLabelText('Senha') as HTMLInputElement;

    fireEvent.input(input, { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect((screen.getByLabelText('Senha') as HTMLInputElement).value).toBe('segredo123');
  });

  it('o botão fica fora da ordem de tabulação do formulário', () => {
    render(<PasswordInput aria-label="Senha" />);
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('repassa props do Input (placeholder, disabled) e o containerClassName', () => {
    const { container } = render(
      <PasswordInput aria-label="Senha" placeholder="Mínimo 6 caracteres" disabled containerClassName="flex-1" />,
    );

    const input = screen.getByPlaceholderText('Mínimo 6 caracteres') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(container.querySelector('div.relative')).toHaveClass('flex-1');
  });
});
