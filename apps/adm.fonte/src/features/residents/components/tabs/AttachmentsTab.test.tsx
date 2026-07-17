import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

const hooks = {
  resident: undefined as unknown,
  signedDocs: [] as unknown[],
  attachments: [] as unknown[],
  templates: [] as unknown[],
  me: { signatureUrl: null } as { signatureUrl: string | null },
};
const addAttachmentMutate = vi.fn();
const deleteAttachmentMutate = vi.fn();
const uploadSignedMutate = vi.fn();

vi.mock('../../hooks/useResidents', () => ({
  useResidentById: () => ({ data: hooks.resident }),
  useResidentDocuments: () => ({ data: hooks.signedDocs }),
  useResidentAttachments: () => ({ data: hooks.attachments }),
  useAddAttachment: () => ({ mutate: addAttachmentMutate, isPending: false }),
  useDeleteAttachment: () => ({ mutate: deleteAttachmentMutate, isPending: false }),
  useUploadSignedDocument: () => ({ mutate: uploadSignedMutate, isPending: false }),
}));
vi.mock('@/features/settings/hooks/useDocumentTemplates', () => ({
  useDocumentTemplates: () => ({ data: hooks.templates }),
}));
vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaffMe: () => ({ data: hooks.me }),
}));
vi.mock('@/features/auth/components/SignatureDialog', () => ({
  SignatureDialog: ({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) =>
    open ? (
      <div data-testid="signature-dialog">
        <button data-testid="sig-save" onClick={() => { onSaved?.(); onClose(); }}>salvar</button>
        <button data-testid="sig-close" onClick={() => onClose()}>fechar</button>
      </div>
    ) : null,
}));
vi.mock('../MissingFieldsDialog', () => ({
  MissingFieldsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="missing-dialog" /> : null,
}));

const downloadDocumentPdf = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    photoUrl: (u: string) => `https://cdn/${u}`,
    residents: { downloadDocumentPdf: (...a: unknown[]) => downloadDocumentPdf(...a) },
  },
}));

import { AttachmentsTab } from './AttachmentsTab';

function template(over: Record<string, unknown> = {}) {
  return { id: 't1', name: 'Termo', content: 'Olá {{name}}', isRequired: false, signAtAdmission: false, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123' };
  hooks.signedDocs = [];
  hooks.attachments = [];
  hooks.templates = [];
  hooks.me = { signatureUrl: null };
});
afterEach(() => cleanup());

describe('AttachmentsTab', () => {
  it('mostra estado vazio sem templates obrigatórios nem anexos', () => {
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Nenhum template marcado como obrigatório no acolhimento.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum anexo adicionado.')).toBeInTheDocument();
  });

  it('renderiza template obrigatório como card com badge pendente', () => {
    hooks.templates = [template({ isRequired: true })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Termo')).toBeInTheDocument();
    expect(screen.getByText('Pendente assinatura')).toBeInTheDocument();
  });

  it('documento assinado mostra badge Assinado', () => {
    hooks.templates = [template({ isRequired: true })];
    hooks.signedDocs = [{ templateId: 't1', signed: true, withinWindow: false, signedAt: '2026-01-01T10:00:00Z' }];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Assinado')).toBeInTheDocument();
  });

  it('seção de assinatura no acolhimento aparece com badge LGPD', () => {
    hooks.templates = [template({ signAtAdmission: true })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Documentos para assinatura no acolhimento')).toBeInTheDocument();
    expect(screen.getByText('LGPD')).toBeInTheDocument();
  });

  it('lista anexos existentes', () => {
    hooks.attachments = [{ id: 'a1', residentId: 'r1', filename: 'rg.pdf', fileUrl: 'u', createdAt: '2026-01-01T00:00:00Z' }];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('rg.pdf')).toBeInTheDocument();
  });

  it('excluir anexo chama a mutation com o id', () => {
    hooks.attachments = [{ id: 'a1', residentId: 'r1', filename: 'rg.pdf', fileUrl: 'u', createdAt: '2026-01-01T00:00:00Z' }];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    const row = screen.getByText('rg.pdf').closest('div.flex.items-center')!;
    const buttons = within(row as HTMLElement).getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(deleteAttachmentMutate).toHaveBeenCalledWith('a1');
  });

  it('gerar documento sem campos faltantes baixa o PDF', async () => {
    downloadDocumentPdf.mockResolvedValue(new Blob(['pdf']));
    const createObjectURL = vi.fn(() => 'blob:1');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    hooks.templates = [template({ isRequired: true, content: 'Olá {{name}}' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    await waitFor(() => expect(downloadDocumentPdf).toHaveBeenCalledWith('r1', 't1'));
    expect(screen.queryByTestId('missing-dialog')).not.toBeInTheDocument();
  });

  it('gerar documento com campo faltante abre o diálogo de campos', async () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '' };
    hooks.templates = [template({ isRequired: true, content: 'CPF: {{cpf}}' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    expect(await screen.findByTestId('missing-dialog')).toBeInTheDocument();
    expect(downloadDocumentPdf).not.toHaveBeenCalled();
  });

  // ─── Assinatura do usuário (story 128) ──────────────────────────────────────

  it('template com {{signature}} e usuário sem assinatura abre o diálogo e NÃO gera', async () => {
    hooks.me = { signatureUrl: null };
    hooks.templates = [template({ isRequired: true, content: 'Assino: {{signature}}' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    expect(await screen.findByTestId('signature-dialog')).toBeInTheDocument();
    expect(downloadDocumentPdf).not.toHaveBeenCalled();
  });

  it('salvar a assinatura no diálogo dispara a geração', async () => {
    downloadDocumentPdf.mockResolvedValue(new Blob(['pdf']));
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
    hooks.me = { signatureUrl: null };
    hooks.templates = [template({ isRequired: true, content: 'Assino: {{signature}}' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    fireEvent.click(await screen.findByTestId('sig-save'));
    await waitFor(() => expect(downloadDocumentPdf).toHaveBeenCalledWith('r1', 't1'));
  });

  it('fechar o diálogo de assinatura sem salvar NÃO gera', async () => {
    hooks.me = { signatureUrl: null };
    hooks.templates = [template({ isRequired: true, content: 'Assino: {{signature}}' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    fireEvent.click(await screen.findByTestId('sig-close'));
    expect(downloadDocumentPdf).not.toHaveBeenCalled();
    expect(screen.queryByTestId('signature-dialog')).not.toBeInTheDocument();
  });

  it('usuário COM assinatura gera direto, sem abrir o diálogo', async () => {
    downloadDocumentPdf.mockResolvedValue(new Blob(['pdf']));
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
    hooks.me = { signatureUrl: 'https://cdn/sig.png' };
    hooks.templates = [template({ isRequired: true, content: 'Assino: {{signature}}' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    await waitFor(() => expect(downloadDocumentPdf).toHaveBeenCalledWith('r1', 't1'));
    expect(screen.queryByTestId('signature-dialog')).not.toBeInTheDocument();
  });

  it('{{signature}} não é tratada como campo faltante do filho (regressão ALWAYS_AVAILABLE)', async () => {
    downloadDocumentPdf.mockResolvedValue(new Blob(['pdf']));
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
    hooks.me = { signatureUrl: 'https://cdn/sig.png' };
    hooks.templates = [template({ isRequired: true, content: '{{signature}}' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    await waitFor(() => expect(downloadDocumentPdf).toHaveBeenCalledWith('r1', 't1'));
    expect(screen.queryByTestId('missing-dialog')).not.toBeInTheDocument();
  });

  it('erro ao gerar mostra alerta dispensável', async () => {
    downloadDocumentPdf.mockRejectedValue(new Error('falha'));
    hooks.templates = [template({ isRequired: true, content: 'sem vars' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
