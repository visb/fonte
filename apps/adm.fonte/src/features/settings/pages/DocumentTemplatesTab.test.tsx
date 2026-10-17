import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="search">{location.search}</span>;
}

/** A aba lê `?newReceipt=` (story 212): precisa de router. */
function renderTab(url = '/settings/templates') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/settings/templates"
          element={
            <>
              <DocumentTemplatesTab />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

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

// Story 193 — o segundo tipo implementado.
const RESIDENT_RECEIPT_TEMPLATE = template({
  id: 'r2',
  name: 'Recibo do acolhido',
  kind: TemplateKind.RECEIPT,
  receiptType: ReceiptType.RESIDENT_CONTRIBUTION,
});

function typeOptions(dialog: HTMLElement): string[] {
  const select = within(dialog).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
  return Array.from(select.options)
    .map((o) => o.value)
    .filter(Boolean);
}

beforeEach(() => {
  vi.clearAllMocks();
  templatesByKind[TemplateKind.RESIDENT] = [template()];
  templatesByKind[TemplateKind.RECEIPT] = [];
});
afterEach(() => cleanup());

describe('DocumentTemplatesTab — dois grupos (story 178)', () => {
  it('renderiza a seção de documentos do acolhido e a de recibos', () => {
    renderTab();
    expect(screen.getByText('Documentos do acolhido')).toBeInTheDocument();
    expect(screen.getByText('Recibos')).toBeInTheDocument();
    expect(screen.getByText('Termo de Acolhimento')).toBeInTheDocument();
    expect(screen.getByText('Nenhum template de recibo cadastrado.')).toBeInTheDocument();
  });

  it('cada grupo lista só os seus templates', () => {
    templatesByKind[TemplateKind.RECEIPT] = [RECEIPT_TEMPLATE];
    renderTab();
    expect(screen.getByText('Recibo de contribuição')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum template de recibo cadastrado.')).not.toBeInTheDocument();
  });
});

describe('DocumentTemplatesTab — criação (story 178)', () => {
  it('criar documento do acolhido NÃO pede tipo de recibo', async () => {
    renderTab();
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

  it('criar recibo pede o tipo ESCOLHIDO e o envia junto do kind (story 212)', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
    // Decisão 2 — começa vazio, sem pré-seleção.
    expect(select.value).toBe('');

    fireEvent.change(within(dialog).getByLabelText(/Nome do documento/i), {
      target: { value: 'Recibo mensal' },
    });
    fireEvent.change(select, { target: { value: ReceiptType.RESIDENT_CONTRIBUTION } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toEqual({
      name: 'Recibo mensal',
      content: '',
      isRequired: false,
      kind: TemplateKind.RECEIPT,
      receiptType: ReceiptType.RESIDENT_CONTRIBUTION,
    });
  });

  it('recibo sem tipo escolhido não cria (story 212)', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Nome do documento/i), {
      target: { value: 'Recibo mensal' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));
    expect(await within(dialog).findByText('Selecione o tipo de recibo')).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  // Story 193 — o tipo do acolhido entrou em IMPLEMENTED_RECEIPT_TYPES; pizza e
  // pão continuam fora (declarados no enum, sem resolver).
  it('só os tipos COM resolver são oferecidos (pizza/pão continuam fora)', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    const values = typeOptions(dialog);
    expect(values).toEqual([
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptType.RESIDENT_CONTRIBUTION,
    ]);
    expect(values).not.toContain(ReceiptType.PIZZA_SALE);
    expect(values).not.toContain(ReceiptType.BREAD_SALE);
  });

  it('tipo JÁ cadastrado some da lista; o outro continua oferecido', async () => {
    templatesByKind[TemplateKind.RECEIPT] = [RECEIPT_TEMPLATE];
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    expect(typeOptions(dialog)).toEqual([ReceiptType.RESIDENT_CONTRIBUTION]);
  });

  it('com os dois tipos cadastrados não sobra tipo livre — e não dá para criar', async () => {
    templatesByKind[TemplateKind.RECEIPT] = [RECEIPT_TEMPLATE, RESIDENT_RECEIPT_TEMPLATE];
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/já têm um template cadastrado/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Criar' })).toBeDisabled();
  });

  it('nome em branco não cria (zod barra antes do request)', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /^Novo template$/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(within(dialog).getByText(/Informe o nome do template/i)).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });
});

// Story 212, decisão 8 — atalho vindo do erro do gerador.
describe('DocumentTemplatesTab — ?newReceipt= (story 212)', () => {
  it('?newReceipt=RESIDENT_CONTRIBUTION abre o dialog de recibo com o tipo e limpa o param', async () => {
    renderTab('/settings/templates?newReceipt=RESIDENT_CONTRIBUTION');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Novo template de recibo')).toBeInTheDocument();
    const select = within(dialog).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(ReceiptType.RESIDENT_CONTRIBUTION));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
  });

  it('param inválido abre o dialog sem seleção', async () => {
    renderTab('/settings/templates?newReceipt=XPTO');
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('tipo já tomado abre sem seleção', async () => {
    templatesByKind[TemplateKind.RECEIPT] = [RESIDENT_RECEIPT_TEMPLATE];
    renderTab('/settings/templates?newReceipt=RESIDENT_CONTRIBUTION');
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('fechar o dialog descarta a pré-seleção', async () => {
    renderTab('/settings/templates?newReceipt=RESIDENT_CONTRIBUTION');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Novo recibo/ }));
    const reopened = await screen.findByRole('dialog');
    const select = within(reopened).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});

describe('DocumentTemplatesTab — edição e exclusão', () => {
  it('clicar num card abre o editor', () => {
    renderTab();
    fireEvent.click(screen.getByText('Termo de Acolhimento'));
    expect(screen.getByTestId('template-editor')).toBeInTheDocument();
  });

  it('recibo em edição ganha a badge Recibo e a do TIPO (story 212)', () => {
    templatesByKind[TemplateKind.RECEIPT] = [RECEIPT_TEMPLATE];
    renderTab();
    fireEvent.click(screen.getByText('Recibo de contribuição'));
    expect(screen.getByText('Recibo')).toBeInTheDocument();
    expect(screen.getByText('Contribuição mensal do associado')).toBeInTheDocument();
  });

  it('documento do acolhido em edição não ganha badge de tipo', () => {
    renderTab();
    fireEvent.click(screen.getByText('Termo de Acolhimento'));
    expect(screen.queryByText(/Contribuição mensal/)).not.toBeInTheDocument();
  });

  it('excluir confirma antes de chamar a mutation', async () => {
    renderTab();
    const card = screen.getByText('Termo de Acolhimento').closest('div[class*="cursor-pointer"]');
    fireEvent.click(within(card as HTMLElement).getByRole('button'));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Excluir' }));
    expect(deleteMutate).toHaveBeenCalledWith('t1', expect.anything());
  });
});
