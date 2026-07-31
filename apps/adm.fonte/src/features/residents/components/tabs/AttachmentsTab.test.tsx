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
  MissingFieldsDialog: ({ open, missingFields, onSaved }: {
    open: boolean;
    missingFields: { residentField: string; label: string }[];
    onSaved: () => void;
  }) =>
    open ? (
      <div data-testid="missing-dialog">
        {missingFields.map((f) => (
          <span key={f.residentField} data-testid="missing-field">{f.label}</span>
        ))}
        <button data-testid="missing-save" onClick={() => onSaved()}>salvar campos</button>
      </div>
    ) : null,
}));

const downloadDocumentPdf = vi.fn();
const downloadCombinedDocumentsPdf = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    photoUrl: (u: string) => `https://cdn/${u}`,
    residents: {
      downloadDocumentPdf: (...a: unknown[]) => downloadDocumentPdf(...a),
      downloadCombinedDocumentsPdf: (...a: unknown[]) => downloadCombinedDocumentsPdf(...a),
    },
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

  it('abrir anexo usa a URL do storage numa aba nova', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    hooks.attachments = [{ id: 'a1', residentId: 'r1', filename: 'rg.pdf', fileUrl: 'u', createdAt: '2026-01-01T00:00:00Z' }];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir/ }));
    expect(open).toHaveBeenCalledWith('https://cdn/u', '_blank', 'noreferrer');
    vi.unstubAllGlobals();
  });

  it('escolher arquivo em "Adicionar anexo" dispara a mutation', () => {
    const { container } = render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    const input = container.querySelector('input[type="file"]:not([accept])') as HTMLInputElement;
    const file = new File(['x'], 'rg.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(addAttachmentMutate).toHaveBeenCalledWith(file);
  });

  it('enviar documento assinado dispara a mutation com o template', () => {
    hooks.templates = [template({ isRequired: true })];
    const { container } = render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar assinado/ }));
    const input = container.querySelector('input[accept="application/pdf"]') as HTMLInputElement;
    const file = new File(['x'], 'assinado.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadSignedMutate).toHaveBeenCalledWith({ templateId: 't1', file });
  });

  it('documento assinado fora da janela não oferece substituir', () => {
    hooks.templates = [template({ isRequired: true })];
    hooks.signedDocs = [{ templateId: 't1', signed: true, withinWindow: false, signedAt: null }];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.queryByRole('button', { name: /Substituir|Enviar assinado/ })).not.toBeInTheDocument();
  });

  it('documento assinado dentro da janela oferece substituir', () => {
    hooks.templates = [template({ isRequired: true })];
    hooks.signedDocs = [{ templateId: 't1', signed: true, withinWindow: true, signedAt: null }];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByRole('button', { name: /Substituir/ })).toBeInTheDocument();
  });

  it('templates opcionais aparecem no menu "Gerar documento"', () => {
    hooks.templates = [template({ id: 'opt', name: 'Opcional' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByRole('button', { name: /Gerar documento/ })).toBeInTheDocument();
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

// ─── PDF combinado para impressão em lote (story 152) ────────────────────────

describe('AttachmentsTab — PDF combinado', () => {
  // Dois grupos: obrigatório primeiro, assinatura no acolhimento depois — é a
  // ordem da tela e, por decisão da story, a ordem do arquivo final.
  function twoTemplates(overA = {}, overB = {}) {
    hooks.templates = [
      template({ id: 't1', name: 'Termo A', isRequired: true, content: 'A de {{name}}', ...overA }),
      template({ id: 't2', name: 'Termo B', signAtAdmission: true, content: 'B de {{name}}', ...overB }),
    ];
  }

  function selectCard(name: string) {
    fireEvent.click(screen.getByRole('checkbox', { name: `Selecionar ${name}` }));
  }

  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
    downloadCombinedDocumentsPdf.mockResolvedValue(new Blob(['pdf']));
  });

  it('sem seleção a barra de ação não aparece', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.queryByRole('button', { name: /Gerar PDF combinado/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('marcar cards mostra a contagem e gera com os ids na ORDEM DA TELA', async () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    // Marca fora de ordem de propósito: quem manda é a ordem dos cards.
    selectCard('Termo B');
    selectCard('Termo A');
    expect(screen.getByText('2 documentos selecionados')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));
    await waitFor(() =>
      expect(downloadCombinedDocumentsPdf).toHaveBeenCalledWith('r1', ['t1', 't2']),
    );
  });

  it('um documento selecionado usa o singular', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();
  });

  it('desmarcar o card tira o documento da seleção', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    selectCard('Termo B');
    selectCard('Termo B');
    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();
  });

  it('"Limpar seleção" esvazia a barra', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(screen.queryByRole('button', { name: /Gerar PDF combinado/ })).not.toBeInTheDocument();
  });

  it('template obrigatório E de assinatura entra uma vez só na contagem', () => {
    hooks.templates = [template({ id: 't1', name: 'Termo A', isRequired: true, signAtAdmission: true })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    // O card aparece nos dois grupos; marcar qualquer um seleciona o template.
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Selecionar Termo A' })[0]);
    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();
  });

  it('{{signature}} em qualquer selecionado sem assinatura do staff abre o diálogo e NÃO gera', async () => {
    hooks.me = { signatureUrl: null };
    twoTemplates({}, { content: 'Assino: {{signature}}' });
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    selectCard('Termo B');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));
    expect(await screen.findByTestId('signature-dialog')).toBeInTheDocument();
    expect(downloadCombinedDocumentsPdf).not.toHaveBeenCalled();
  });

  it('salvar a assinatura retoma a geração combinada', async () => {
    hooks.me = { signatureUrl: null };
    twoTemplates({}, { content: 'Assino: {{signature}}' });
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    selectCard('Termo B');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));
    fireEvent.click(await screen.findByTestId('sig-save'));
    await waitFor(() =>
      expect(downloadCombinedDocumentsPdf).toHaveBeenCalledWith('r1', ['t1', 't2']),
    );
  });

  it('campos faltantes de qualquer selecionado abrem o diálogo com a UNIÃO deduplicada', async () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '', rg: '', birthDate: null };
    twoTemplates(
      { content: 'CPF {{cpf}} e idade {{age}}' },
      { content: 'RG {{rg}}, nasc {{birthDate}} e idade {{age}}' },
    );
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    selectCard('Termo B');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));

    expect(await screen.findByTestId('missing-dialog')).toBeInTheDocument();
    // {{age}} e {{birthDate}} pedem o mesmo campo → uma pergunta só.
    const labels = screen.getAllByTestId('missing-field').map((el) => el.textContent);
    expect(labels).toEqual(['CPF', 'Data de nascimento', 'RG']);
    expect(downloadCombinedDocumentsPdf).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('missing-save'));
    await waitFor(() =>
      expect(downloadCombinedDocumentsPdf).toHaveBeenCalledWith('r1', ['t1', 't2']),
    );
  });

  it('erro do endpoint combinado renderiza o alerta com a mensagem da API', async () => {
    downloadCombinedDocumentsPdf.mockRejectedValue({
      response: { data: { message: 'Selecione ao menos um documento.' } },
    });
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecione ao menos um documento.');
  });

  it('sem dados do filho carregados a geração combinada segue direto', async () => {
    hooks.resident = undefined;
    twoTemplates({ content: 'CPF {{cpf}}' });
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));
    await waitFor(() => expect(downloadCombinedDocumentsPdf).toHaveBeenCalledWith('r1', ['t1']));
    expect(screen.queryByTestId('missing-dialog')).not.toBeInTheDocument();
  });
});
