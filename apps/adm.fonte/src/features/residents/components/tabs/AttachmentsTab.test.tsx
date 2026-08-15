import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { ResidentStatus, TemplateAvailability, TemplateKind } from '@fonte/types';

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

// ─── Disponibilidade do template por status do filho (story 160) ─────────────

describe('AttachmentsTab — filtro por status do filho', () => {
  function threeTemplates() {
    hooks.templates = [
      template({ id: 't1', name: 'Ficha de acolhimento', isRequired: true, availableFor: TemplateAvailability.ACTIVE_ONLY }),
      template({ id: 't2', name: 'Declaração de alta', isRequired: true, availableFor: TemplateAvailability.INACTIVE_ONLY }),
      template({ id: 't3', name: 'Termo geral', isRequired: true, availableFor: TemplateAvailability.ALL }),
    ];
  }

  it('filho ATIVO não vê o documento de desligamento', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.ACTIVE };
    threeTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Ficha de acolhimento')).toBeInTheDocument();
    expect(screen.getByText('Termo geral')).toBeInTheDocument();
    expect(screen.queryByText('Declaração de alta')).not.toBeInTheDocument();
  });

  it('filho em ALTA vê o de desligamento e não vê o de acolhimento', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.DISCHARGED };
    threeTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Declaração de alta')).toBeInTheDocument();
    expect(screen.getByText('Termo geral')).toBeInTheDocument();
    expect(screen.queryByText('Ficha de acolhimento')).not.toBeInTheDocument();
  });

  // Decisão 3 da story: pré-admissão está do lado ATIVO — é nesse status que o
  // wizard imprime a ficha de acolhimento.
  it('filho em PRE_ADMISSION conta como ativo', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.PRE_ADMISSION };
    threeTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Ficha de acolhimento')).toBeInTheDocument();
    expect(screen.queryByText('Declaração de alta')).not.toBeInTheDocument();
  });

  it('o menu "Gerar documento" (opcionais) também respeita o filtro', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.ACTIVE };
    hooks.templates = [
      template({ id: 'opt', name: 'Opcional de alta', availableFor: TemplateAvailability.INACTIVE_ONLY }),
    ];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.queryByRole('button', { name: /Gerar documento/ })).not.toBeInTheDocument();
  });

  it('seção de assinatura no acolhimento some quando nenhum template vale para o status', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.EVADED };
    hooks.templates = [
      template({ id: 't1', name: 'Termo LGPD', signAtAdmission: true, availableFor: TemplateAvailability.ACTIVE_ONLY }),
    ];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.queryByText('Documentos para assinatura no acolhimento')).not.toBeInTheDocument();
  });

  // Enquanto o filho carrega não há status: o predicado é o MESMO do backend,
  // que também recusaria gerar sem status — só os ALL sobrevivem.
  it('sem o filho carregado, só os templates ALL aparecem', () => {
    hooks.resident = undefined;
    threeTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Termo geral')).toBeInTheDocument();
    expect(screen.queryByText('Ficha de acolhimento')).not.toBeInTheDocument();
    expect(screen.queryByText('Declaração de alta')).not.toBeInTheDocument();
  });
});

// ─── Recibo nunca vira anexo do filho (story 178) ─────────────────────────────
// O isolamento real vem do backend (findAll com default RESIDENT). Este teste é
// o cinto e suspensório: mesmo que um recibo chegue na lista, ele não pode
// aparecer em nenhuma das três seções nem no menu de opcionais.

describe('AttachmentsTab — template de recibo (story 178)', () => {
  it('recibo presente na lista não aparece em nenhuma seção', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.ACTIVE };
    hooks.templates = [
      template({ id: 't1', name: 'Termo geral', isRequired: true }),
      template({
        id: 'r-1',
        name: 'Recibo de contribuição',
        kind: TemplateKind.RECEIPT,
        receiptType: 'ASSOCIATE_CONTRIBUTION',
        isRequired: true,
        signAtAdmission: true,
      }),
    ];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Termo geral')).toBeInTheDocument();
    expect(screen.queryByText('Recibo de contribuição')).not.toBeInTheDocument();
    expect(screen.queryByText('Documentos para assinatura no acolhimento')).not.toBeInTheDocument();
  });

  it('recibo opcional não entra no menu "Gerar documento"', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.ACTIVE };
    hooks.templates = [
      template({ id: 'r-1', name: 'Recibo de contribuição', kind: TemplateKind.RECEIPT }),
    ];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.queryByRole('button', { name: /Gerar documento/ })).not.toBeInTheDocument();
  });

  it('template legado (sem kind) segue aparecendo — o filtro não pune quem já existia', () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.ACTIVE };
    hooks.templates = [template({ id: 't1', name: 'Termo legado', isRequired: true, kind: undefined })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Termo legado')).toBeInTheDocument();
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

  // Story 161 — checkbox de cabeçalho da barra (marcar/desmarcar todos).
  function selectAllCheckbox() {
    return screen.getByRole('checkbox', { name: 'Selecionar todos os documentos' }) as HTMLInputElement;
  }

  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
    downloadCombinedDocumentsPdf.mockResolvedValue(new Blob(['pdf']));
  });

  // Story 161 — a barra nasce na tela, sem nada marcado: o botão existe (e
  // ensina que a impressão em lote está ali), só desabilitado.
  it('a barra aparece na primeira renderização, sem seleção, com o botão desabilitado', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByRole('button', { name: /Gerar PDF combinado/ })).toBeDisabled();
    expect(screen.getByText('Nenhum documento selecionado')).toBeInTheDocument();
    // 2 checkboxes de card + o de "marcar todos" da barra.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(selectAllCheckbox()).not.toBeChecked();
    expect(selectAllCheckbox().indeterminate).toBe(false);
  });

  // Sem nenhum template selecionável a barra continua na tela (decisão 1), com
  // os dois controles desabilitados.
  it('sem documentos selecionáveis a barra permanece, toda desabilitada', () => {
    hooks.templates = [template({ id: 'opt', name: 'Opcional' })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    expect(screen.getByText('Nenhum documento selecionado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar PDF combinado/ })).toBeDisabled();
    expect(selectAllCheckbox()).toBeDisabled();
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

  it('template obrigatório E de assinatura entra uma vez só na contagem', () => {
    hooks.templates = [template({ id: 't1', name: 'Termo A', isRequired: true, signAtAdmission: true })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    // O card aparece nos dois grupos; marcar qualquer um seleciona o template.
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Selecionar Termo A' })[0]);
    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();
  });

  // ─── Marcar/desmarcar todos (story 161) ───────────────────────────────────

  it('marcar todos pelo checkbox da barra marca os checkboxes dos cards', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(selectAllCheckbox());

    expect(screen.getByText('2 documentos selecionados')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Selecionar Termo A' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Selecionar Termo B' })).toBeChecked();
    expect(selectAllCheckbox()).toBeChecked();
    expect(selectAllCheckbox().indeterminate).toBe(false);
  });

  it('desmarcar todos pelo checkbox da barra limpa os cards', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(selectAllCheckbox());
    fireEvent.click(selectAllCheckbox());

    expect(screen.getByText('Nenhum documento selecionado')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Selecionar Termo A' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Selecionar Termo B' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Gerar PDF combinado/ })).toBeDisabled();
  });

  it('seleção parcial deixa o checkbox da barra indeterminate e clicar nele marca todos', () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    selectCard('Termo A');
    expect(selectAllCheckbox().indeterminate).toBe(true);
    expect(selectAllCheckbox()).not.toBeChecked();

    fireEvent.click(selectAllCheckbox());
    expect(screen.getByText('2 documentos selecionados')).toBeInTheDocument();
  });

  // Decisão 5: opcionais só existem no menu "Gerar documento" — não têm card
  // com checkbox e não entram no "todos".
  it('o "marcar todos" ignora os templates opcionais', () => {
    hooks.templates = [
      template({ id: 't1', name: 'Termo A', isRequired: true }),
      template({ id: 'opt', name: 'Opcional' }),
    ];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(selectAllCheckbox());
    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Selecionar Opcional' })).not.toBeInTheDocument();
  });

  // Regressão da dedupe da story 152: o card aparece nos dois grupos, mas o
  // total do "todos" é 1 — senão o checkbox nunca ficaria "checked".
  it('template obrigatório E de assinatura conta uma vez no total do "marcar todos"', () => {
    hooks.templates = [template({ id: 't1', name: 'Termo A', isRequired: true, signAtAdmission: true })];
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(selectAllCheckbox());

    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();
    expect(selectAllCheckbox()).toBeChecked();
    expect(selectAllCheckbox().indeterminate).toBe(false);
  });

  // Story 160 + 161: o "todos" opera sobre a lista JÁ filtrada por status.
  it('o "marcar todos" não seleciona template indisponível para o status', async () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.ACTIVE };
    twoTemplates({}, { availableFor: TemplateAvailability.INACTIVE_ONLY });
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);

    fireEvent.click(selectAllCheckbox());
    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));
    await waitFor(() => expect(downloadCombinedDocumentsPdf).toHaveBeenCalledWith('r1', ['t1']));
  });

  // Decisão 6: o download é o fim do fluxo — a barra volta ao estado inicial.
  it('gerar o PDF com sucesso limpa a seleção', async () => {
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(selectAllCheckbox());
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));

    await waitFor(() => expect(screen.getByText('Nenhum documento selecionado')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: 'Selecionar Termo A' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Gerar PDF combinado/ })).toBeDisabled();
  });

  it('erro ao gerar o PDF mantém a seleção para nova tentativa', async () => {
    downloadCombinedDocumentsPdf.mockRejectedValue(new Error('falha'));
    twoTemplates();
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);
    fireEvent.click(selectAllCheckbox());
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('2 documentos selecionados')).toBeInTheDocument();
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

  // Story 160 — o template escondido não pode entrar na seleção do combinado:
  // é o que garante que a tela nunca monta uma requisição que o backend recusa.
  it('template indisponível para o status não entra na seleção do PDF combinado', async () => {
    hooks.resident = { id: 'r1', name: 'Fulano', cpf: '123', status: ResidentStatus.ACTIVE };
    twoTemplates({}, { availableFor: TemplateAvailability.INACTIVE_ONLY });
    render(<AttachmentsTab residentId="r1" residentName="Fulano" />);

    expect(screen.queryByRole('checkbox', { name: 'Selecionar Termo B' })).not.toBeInTheDocument();
    selectCard('Termo A');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF combinado/ }));
    await waitFor(() => expect(downloadCombinedDocumentsPdf).toHaveBeenCalledWith('r1', ['t1']));
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
