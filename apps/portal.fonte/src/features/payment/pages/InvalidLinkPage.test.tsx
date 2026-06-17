import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvalidLinkPage } from './InvalidLinkPage';

describe('InvalidLinkPage', () => {
  it('renderiza a tela de erro de link inválido', () => {
    render(<InvalidLinkPage />);

    expect(screen.getByRole('heading', { name: 'Link inválido' })).toBeInTheDocument();
    expect(
      screen.getByText(/use o link de pagamento que você recebeu pelo whatsapp/i),
    ).toBeInTheDocument();
  });
});
