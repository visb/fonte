import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { ResidentFormData } from '../../lib/residentSchema';
import type { DraftRelative } from '../../lib/types';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const mutate = vi.fn();
vi.mock('../../hooks/useResidents', () => ({
  useCreateResident: () => ({ mutate }),
}));

const relativesCreate = vi.fn();
const addAttachment = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    relatives: { create: (...a: unknown[]) => relativesCreate(...a) },
    residents: {
      create: vi.fn(),
      addAttachment: (...a: unknown[]) => addAttachment(...a),
    },
  },
}));

import { ImportSummaryStep } from './ImportSummaryStep';

const residentValues = { name: 'Fulano de Tal' } as unknown as ResidentFormData;

function draft(over: Partial<DraftRelative> = {}): DraftRelative {
  return { id: crypto.randomUUID(), name: 'Maria', phone: '11999', relationship: 'Mãe', include: true, ...over };
}

function docxFile() {
  return new File(['x'], 'ficha.docx', { type: 'application/octet-stream' });
}

function renderStep(props: Partial<Parameters<typeof ImportSummaryStep>[0]> = {}) {
  const onBack = vi.fn();
  render(
    <ImportSummaryStep
      residentValues={residentValues}
      relatives={[draft()]}
      houses={[]}
      docxFile={docxFile()}
      photo={null}
      extraFiles={[]}
      onBack={onBack}
      {...props}
    />,
  );
  return { onBack };
}

beforeEach(() => {
  vi.clearAllMocks();
  mutate.mockImplementation((_vars, opts) => opts.onSuccess({ id: 'res-1' }));
  relativesCreate.mockResolvedValue({});
  addAttachment.mockResolvedValue({});
});
afterEach(() => cleanup());

describe('ImportSummaryStep', () => {
  it('mostra título e a ficha original a anexar', () => {
    renderStep();
    expect(screen.getByText('Resumo da importação')).toBeInTheDocument();
    expect(screen.getByText('ficha.docx')).toBeInTheDocument();
    expect(screen.getByText('(ficha original)')).toBeInTheDocument();
  });

  it('lista familiares incluídos com nome válido', () => {
    renderStep({ relatives: [draft({ name: 'Maria' }), draft({ name: '', include: true }), draft({ name: 'João', include: false })] });
    expect(screen.getByText('Familiares (1)')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.queryByText('João')).not.toBeInTheDocument();
  });

  it('mostra seção de foto quando há foto', () => {
    renderStep({ photo: new Blob(['x']) });
    expect(screen.getByText('Foto de perfil')).toBeInTheDocument();
  });

  it('lista arquivos extras', () => {
    renderStep({ extraFiles: [new File(['x'], 'rg.pdf')] });
    expect(screen.getByText('rg.pdf')).toBeInTheDocument();
  });

  it('confirmar cria residente, familiares, anexa docx e navega', async () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e salvar/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/residents/res-1?tab=attachments'));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(relativesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ residentId: 'res-1', name: 'Maria' }),
    );
    expect(addAttachment).toHaveBeenCalledWith('res-1', expect.any(FormData));
  });

  it('falha na criação do residente mostra erro e não navega', async () => {
    mutate.mockImplementation((_vars, opts) => opts.onError(new Error('falhou')));
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e salvar/ }));
    await waitFor(() =>
      expect(screen.getByText('Erro ao salvar o residente. Tente novamente.')).toBeInTheDocument(),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('voltar dispara onBack', () => {
    const { onBack } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
