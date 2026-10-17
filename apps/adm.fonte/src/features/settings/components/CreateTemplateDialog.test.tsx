import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReceiptType, TemplateKind } from '@fonte/types';

const createMutate = vi.fn();
const createState = { isPending: false, isError: false, error: null as unknown };

vi.mock('../hooks/useDocumentTemplates', () => ({
  useCreateDocumentTemplate: () => ({ mutate: createMutate, ...createState }),
}));

import { CreateTemplateDialog } from './CreateTemplateDialog';

function renderDialog(props: Partial<Parameters<typeof CreateTemplateDialog>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <CreateTemplateDialog
      open
      onClose={onClose}
      kind={TemplateKind.RECEIPT}
      takenReceiptTypes={[]}
      {...props}
    />,
  );
  return { onClose, dialog: screen.getByRole('dialog') };
}

function typeSelect(dialog: HTMLElement) {
  return within(dialog).getByLabelText(/Tipo de recibo/i) as HTMLSelectElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  createState.isPending = false;
  createState.isError = false;
  createState.error = null;
});
afterEach(() => cleanup());

describe('CreateTemplateDialog (story 212)', () => {
  it('abre sem tipo selecionado, com o placeholder "Selecione o tipo"', () => {
    const { dialog } = renderDialog();
    const select = typeSelect(dialog);
    expect(select.value).toBe('');
    expect(select.options[0].textContent).toBe('Selecione o tipo');
  });

  it('submit sem tipo → erro de validação, sem request', async () => {
    const { dialog } = renderDialog();
    fireEvent.change(within(dialog).getByLabelText(/Nome do documento/i), {
      target: { value: 'Recibo' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));
    expect(await within(dialog).findByText('Selecione o tipo de recibo')).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('voltar o select para vazio também barra', async () => {
    const { dialog } = renderDialog({ initialReceiptType: ReceiptType.ASSOCIATE_CONTRIBUTION });
    fireEvent.change(typeSelect(dialog), { target: { value: '' } });
    fireEvent.change(within(dialog).getByLabelText(/Nome do documento/i), {
      target: { value: 'Recibo' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));
    expect(await within(dialog).findByText('Selecione o tipo de recibo')).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('com initialReceiptType abre com ele selecionado e cria com ele; sucesso fecha', async () => {
    const { dialog, onClose } = renderDialog({
      initialReceiptType: ReceiptType.RESIDENT_CONTRIBUTION,
    });
    await waitFor(() => expect(typeSelect(dialog).value).toBe(ReceiptType.RESIDENT_CONTRIBUTION));
    fireEvent.change(within(dialog).getByLabelText(/Nome do documento/i), {
      target: { value: '  Recibo do filho  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toEqual({
      name: 'Recibo do filho',
      content: '',
      isRequired: false,
      kind: TemplateKind.RECEIPT,
      receiptType: ReceiptType.RESIDENT_CONTRIBUTION,
    });
    createMutate.mock.calls[0][1].onSuccess();
    expect(onClose).toHaveBeenCalled();
  });

  it('initialReceiptType já tomado é ignorado (abre sem seleção)', () => {
    const { dialog } = renderDialog({
      takenReceiptTypes: [ReceiptType.RESIDENT_CONTRIBUTION],
      initialReceiptType: ReceiptType.RESIDENT_CONTRIBUTION,
    });
    expect(typeSelect(dialog).value).toBe('');
  });

  it('tipos tomados não aparecem', () => {
    const { dialog } = renderDialog({ takenReceiptTypes: [ReceiptType.ASSOCIATE_CONTRIBUTION] });
    const values = Array.from(typeSelect(dialog).options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(values).toEqual([ReceiptType.RESIDENT_CONTRIBUTION]);
  });

  it('documento do acolhido ignora initialReceiptType e não pede tipo', () => {
    const { dialog } = renderDialog({
      kind: TemplateKind.RESIDENT,
      initialReceiptType: ReceiptType.RESIDENT_CONTRIBUTION,
    });
    expect(within(dialog).queryByLabelText(/Tipo de recibo/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText('Novo template')).toBeInTheDocument();
  });

  it('erro do backend aparece com getErrorMessage; Cancelar fecha', () => {
    createState.isError = true;
    createState.error = { response: { data: { message: 'Template com nome "X" já existe' } } };
    const { dialog, onClose } = renderDialog();
    expect(within(dialog).getByText('Template com nome "X" já existe')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('enquanto cria, o botão mostra "Criando..." desabilitado', () => {
    createState.isPending = true;
    const { dialog } = renderDialog();
    expect(within(dialog).getByRole('button', { name: 'Criando...' })).toBeDisabled();
  });
});
