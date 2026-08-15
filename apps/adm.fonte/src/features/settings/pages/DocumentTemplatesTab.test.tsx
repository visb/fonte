import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DocumentTemplate } from '@fonte/api-client';
import { ReceiptType, TemplateAvailability, TemplateKind } from '@fonte/types';

// Story 178 — a aba passa a ter DOIS grupos. Os hooks são mockados para a spec
// falar só do que a tela decide: quem vai em qual grupo e o que o dialog de
// criação oferece.

const createMutate = vi.fn();
const deleteMutate = vi.fn();
const templatesByKind: Record<string, DocumentTemplate[]> = {
  [TemplateKind.RESIDENT]: [],
  [TemplateKind.RECEIPT]: [],
};

vi.mock('../hooks/useDocumentTemplates', () => ({
  useDocumentTemplates: (kind: TemplateKind) => ({ data: templatesByKind[kind] }),
  useCreateDocumentTemplate: () => ({
    mutate: createMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useDeleteDocumentTemplate: () => ({ mutate: deleteMutate, isPending: false }),
}));

// O editor real depende do TipTap/ProseMirror, que o jsdom não implementa.
vi.mock('../components/TemplateEditor', () => ({
  TemplateEditor: () => <div data-testid="template-editor" />,
}));

import { DocumentTemplatesTab } from './DocumentTemplatesTab';

function template(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 't1',
    name: 'Termo de Acolhimento',
    content: '<p/>',
    isRequired: false,
    signAtAdmission: false,
    availableFor: TemplateAvailability.ALL,
    kind: TemplateKind.RESIDENT,
    receiptType: null,
    updatedAt: '2026-06-01T12:00:00.000Z',
    ...overrides,
  } as DocumentTemplate;
}

const RECEIPT_TEMPLATE = template({
  id: 'r1',
  name: 'Recibo de contribuição',
  kind: TemplateKind.RECEIPT,
  receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
});

beforeEach(() => {
  vi.clearAllMocks();
  templatesByKind[TemplateKind.RESIDENT] = [template()];
  templatesByKind[TemplateKind.RECEIPT] = [];
});
afterEach(() => cleanup());

describe('DocumentTemplatesTab — dois grupos (story 178)', () => {
  it('renderiza a seção de documentos do acolhido e a de recibos', () => {
    render(<DocumentTemplatesTab />);
    expect(screen.getByText('Documentos do acolhido')).toBeInTheDocument();
    expect(screen.getByText('Recibos')).toBeInTheDocument();
    expect(screen.getByText('Termo de Acolhimento')).toBeInTheDocument();
    expect(screen.getByText('Nenhum template de recibo cadastrado.')).toBeInTheDocument();
  });

  it('cada grupo lista só os seus templates', () => {
    templatesByKind[TemplateKind.RECEIPT] = [RECEIPT_TEMPLATE];
    render(<DocumentTemplatesTab />);
    expect(screen.getByText('Recibo de contribuição')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum template de recibo cadastrado.')).not.toBeInTheDocument();
  });
});

describe('DocumentTemplatesTab — criação (story 178)', () => {
  it('criar documento do acolhido NÃO pede tipo de recibo', async () => {
    render(<DocumentTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: /^Novo template$/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Tipo de recibo/i)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Nome do documento/i), {
      target: { value: 'Termo novo' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    // Sem kind: o backend aplica o default RESIDENT.
    expect(createMutate.mock.calls[0][0]).toEqual({
      name: 'Termo novo',
      content: '',
      isRequired: false,
    });
  });

  it('criar recibo pede o tipo e o envia junto do kind', async () => {
    render(<DocumentTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Tipo de recibo/i)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Nome do documento/i), {
      target: { value: 'Recibo mensal' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toEqual({
      name: 'Recibo mensal',
      content: '',
      isRequired: false,
      kind: TemplateKind.RECEIPT,
      receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
    });
  });

  it('tipo sem resolver (pizza/pão) não é oferecido', async () => {
    render(<DocumentTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([ReceiptType.ASSOCIATE_CONTRIBUTION]);
    expect(values).not.toContain(ReceiptType.PIZZA_SALE);
    expect(values).not.toContain(ReceiptType.BREAD_SALE);
  });

  it('tipo JÁ cadastrado não é oferecido — e sem tipo livre não dá para criar', async () => {
    templatesByKind[TemplateKind.RECEIPT] = [RECEIPT_TEMPLATE];
    render(<DocumentTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/já têm um template cadastrado/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Criar' })).toBeDisabled();
  });

  it('nome em branco não cria (zod barra antes do request)', async () => {
    render(<DocumentTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: /^Novo template$/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(within(dialog).getByText(/Informe o nome do template/i)).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });
});

describe('DocumentTemplatesTab — edição e exclusão', () => {
  it('clicar num card abre o editor', () => {
    render(<DocumentTemplatesTab />);
    fireEvent.click(screen.getByText('Termo de Acolhimento'));
    expect(screen.getByTestId('template-editor')).toBeInTheDocument();
  });

  it('recibo em edição ganha a badge Recibo', () => {
    templatesByKind[TemplateKind.RECEIPT] = [RECEIPT_TEMPLATE];
    render(<DocumentTemplatesTab />);
    fireEvent.click(screen.getByText('Recibo de contribuição'));
    expect(screen.getByText('Recibo')).toBeInTheDocument();
  });

  it('excluir confirma antes de chamar a mutation', async () => {
    render(<DocumentTemplatesTab />);
    const card = screen.getByText('Termo de Acolhimento').closest('div[class*="cursor-pointer"]');
    fireEvent.click(within(card as HTMLElement).getByRole('button'));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Excluir' }));
    expect(deleteMutate).toHaveBeenCalledWith('t1', expect.anything());
  });
});
