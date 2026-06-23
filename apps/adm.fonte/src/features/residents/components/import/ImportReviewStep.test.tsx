import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { ParseResult } from '../../lib/types';

let housesResult: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => housesResult,
}));
vi.mock('@/components/AvatarUpload', () => ({
  AvatarUpload: () => <div data-testid="avatar-upload" />,
}));

import { ImportReviewStep } from './ImportReviewStep';

const parseResult = (overrides: Partial<ParseResult> = {}): ParseResult =>
  ({ houseName: null, ...overrides }) as ParseResult;

function renderStep(props: Partial<Parameters<typeof ImportReviewStep>[0]> = {}) {
  const onBack = vi.fn();
  const onNext = vi.fn();
  const onPhotoChange = vi.fn();
  render(
    <ImportReviewStep
      parseResult={parseResult()}
      initialValues={{ name: 'Filho A' }}
      photo={null}
      onPhotoChange={onPhotoChange}
      onBack={onBack}
      onNext={onNext}
      {...props}
    />,
  );
  return { onBack, onNext };
}

beforeEach(() => {
  vi.clearAllMocks();
  housesResult = { data: [{ id: 'h1', name: 'Casa Belém' }], isLoading: false };
});
afterEach(() => cleanup());

describe('ImportReviewStep', () => {
  it('loading de casas mostra estado de carregamento', () => {
    housesResult = { data: [], isLoading: true };
    renderStep();
    expect(screen.queryByText('Revisar dados do residente')).not.toBeInTheDocument();
  });

  it('renderiza título, avatar e seções do formulário', () => {
    renderStep();
    expect(screen.getByText('Revisar dados do residente')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
    expect((screen.getByPlaceholderText('Nome do acolhido') as HTMLInputElement).value).toBe('Filho A');
  });

  it('mostra aviso de casa detectada quando houseName e nenhuma casa correspondente', () => {
    housesResult = { data: [{ id: 'h9', name: 'Outra Casa' }], isLoading: false };
    renderStep({ parseResult: parseResult({ houseName: 'Casa Inexistente' }) });
    expect(screen.getByText(/Casa detectada na ficha/)).toBeInTheDocument();
  });

  it('voltar dispara onBack', () => {
    const { onBack } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(onBack).toHaveBeenCalled();
  });

  it('submit válido (casa selecionada) avança', async () => {
    const { onNext } = renderStep();
    // o select de Casa é o combobox que contém a opção "Casa Belém"
    const houseSelect = screen
      .getAllByRole('combobox')
      .find((el) => el.textContent?.includes('Casa Belém'))!;
    fireEvent.change(houseSelect, { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /Próximo: Familiares/ }));
    await waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(onNext.mock.calls[0][0].name).toBe('Filho A');
  });
});
