import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const state = {
  attachments: [] as unknown[],
  isLoading: false,
  isError: false,
  uploadIsError: false,
};
const uploadMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock('../hooks/useStaff', () => ({
  useStaffAttachments: () => ({
    data: state.attachments,
    isLoading: state.isLoading,
    isError: state.isError,
  }),
  useUploadStaffAttachment: () => ({
    mutate: uploadMutate,
    isPending: false,
    isError: state.uploadIsError,
    error: new Error('boom'),
  }),
  useDeleteStaffAttachment: () => ({ mutate: deleteMutate, isPending: false }),
}));

const windowOpen = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { photoUrl: (u: string) => `https://cdn/${u}` },
}));
vi.mock('@/lib/errors', () => ({
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { StaffAttachmentsTab } from './StaffAttachmentsTab';

function attachment(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    staffId: 's1',
    fileUrl: 'attachments/staff/uniq.pdf',
    fileName: 'contrato.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 10,
    createdByUserId: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.attachments = [];
  state.isLoading = false;
  state.isError = false;
  state.uploadIsError = false;
  vi.stubGlobal('open', windowOpen);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StaffAttachmentsTab', () => {
  it('mostra loading enquanto busca', () => {
    state.isLoading = true;
    render(<StaffAttachmentsTab staffId="s1" />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra erro quando a busca falha', () => {
    state.isError = true;
    render(<StaffAttachmentsTab staffId="s1" />);
    expect(screen.getByText('Erro ao carregar os anexos.')).toBeInTheDocument();
  });

  it('mostra estado vazio sem anexos', () => {
    render(<StaffAttachmentsTab staffId="s1" />);
    expect(screen.getByText('Nenhum anexo adicionado.')).toBeInTheDocument();
  });

  it('lista anexos com nome e data', () => {
    state.attachments = [attachment()];
    render(<StaffAttachmentsTab staffId="s1" />);
    expect(screen.getByText('contrato.pdf')).toBeInTheDocument();
  });

  it('selecionar arquivo dispara a mutation de upload', () => {
    const { container } = render(<StaffAttachmentsTab staffId="s1" />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadMutate).toHaveBeenCalledWith(file);
  });

  it('exibe a mensagem de erro do upload', () => {
    state.uploadIsError = true;
    render(<StaffAttachmentsTab staffId="s1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao enviar o anexo.');
  });

  it('abrir usa a URL assinada em nova aba', () => {
    state.attachments = [attachment()];
    render(<StaffAttachmentsTab staffId="s1" />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir/ }));
    expect(windowOpen).toHaveBeenCalledWith(
      'https://cdn/attachments/staff/uniq.pdf',
      '_blank',
      'noreferrer',
    );
  });

  it('remover pede confirmação e só deleta ao confirmar', async () => {
    state.attachments = [attachment()];
    render(<StaffAttachmentsTab staffId="s1" />);

    fireEvent.click(screen.getByTitle('Remover anexo'));
    expect(deleteMutate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Remover anexo', { selector: 'h2' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(deleteMutate).toHaveBeenCalledWith('a1', expect.anything());
  });

  it('cancelar a confirmação não deleta', async () => {
    state.attachments = [attachment()];
    render(<StaffAttachmentsTab staffId="s1" />);

    fireEvent.click(screen.getByTitle('Remover anexo'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(deleteMutate).not.toHaveBeenCalled();
  });
});
