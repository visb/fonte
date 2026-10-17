import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DocumentTemplate } from '@fonte/api-client';
import { ReceiptType, TemplateAvailability, TemplateKind } from '@fonte/types';

const updateMutate = vi.fn();
const updateState = { isPending: false, isError: false, error: null as unknown };
let receiptTemplates: DocumentTemplate[] = [];

vi.mock('../hooks/useDocumentTemplates', () => ({
  useDocumentTemplates: () => ({ data: receiptTemplates }),
  useUpdateDocumentTemplate: () => ({ mutate: updateMutate, ...updateState }),
}));

import { ReceiptTypeField } from './ReceiptTypeField';

function receipt(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 'r1',
    name: 'Recibo teste',
    content: '<p>conteúdo em edição</p>',
    isRequired: false,
    signAtAdmission: false,
    availableFor: TemplateAvailability.ALL,
    kind: TemplateKind.RECEIPT,
    receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  } as DocumentTemplate;
}

function options(): string[] {
  const select = screen.getByLabelText('Tipo de recibo') as HTMLSelectElement;
  return Array.from(select.options).map((o) => o.value);
}

beforeEach(() => {
  vi.clearAllMocks();
  updateState.isPending = false;
  updateState.isError = false;
  updateState.error = null;
  receiptTemplates = [];
});
afterEach(() => cleanup());

describe('ReceiptTypeField (story 212)', () => {
  it('lista o tipo atual e os tipos livres', () => {
    const current = receipt();
    receiptTemplates = [current];
    render(<ReceiptTypeField template={current} onChanged={vi.fn()} />);
    expect(options()).toEqual([
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptType.RESIDENT_CONTRIBUTION,
    ]);
    expect((screen.getByLabelText('Tipo de recibo') as HTMLSelectElement).value).toBe(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
    );
  });

  it('tipo usado por OUTRO template não é oferecido', () => {
    const current = receipt();
    receiptTemplates = [
      current,
      receipt({ id: 'r2', receiptType: ReceiptType.RESIDENT_CONTRIBUTION }),
    ];
    render(<ReceiptTypeField template={current} onChanged={vi.fn()} />);
    expect(options()).toEqual([ReceiptType.ASSOCIATE_CONTRIBUTION]);
  });

  it('tipo atual fora dos implementados continua visível', () => {
    const current = receipt({ receiptType: ReceiptType.PIZZA_SALE });
    render(<ReceiptTypeField template={current} onChanged={vi.fn()} />);
    expect(options()[0]).toBe(ReceiptType.PIZZA_SALE);
  });

  it('sem tipo atual mostra o placeholder', () => {
    render(<ReceiptTypeField template={receipt({ receiptType: null })} onChanged={vi.fn()} />);
    expect(options()[0]).toBe('');
  });

  it('trocar chama o update SÓ com o receiptType e devolve o tipo novo sem tocar no conteúdo', () => {
    const current = receipt();
    const onChanged = vi.fn();
    render(<ReceiptTypeField template={current} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText('Tipo de recibo'), {
      target: { value: ReceiptType.RESIDENT_CONTRIBUTION },
    });
    expect(updateMutate).toHaveBeenCalledWith(
      { id: 'r1', data: { receiptType: ReceiptType.RESIDENT_CONTRIBUTION } },
      expect.anything(),
    );
    updateMutate.mock.calls[0][1].onSuccess(
      receipt({ receiptType: ReceiptType.RESIDENT_CONTRIBUTION, content: '<p>do servidor</p>' }),
    );
    expect(onChanged).toHaveBeenCalledWith({
      ...current,
      receiptType: ReceiptType.RESIDENT_CONTRIBUTION,
    });
  });

  it('escolher o mesmo tipo (ou vazio) não chama o update', () => {
    render(<ReceiptTypeField template={receipt({ receiptType: null })} onChanged={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Tipo de recibo'), { target: { value: '' } });
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('erro de conflito aparece com a mensagem do backend', () => {
    updateState.isError = true;
    updateState.error = {
      response: { status: 409, data: { message: 'Já existe um template para este tipo de recibo' } },
    };
    render(<ReceiptTypeField template={receipt()} onChanged={vi.fn()} />);
    expect(
      screen.getByText('Já existe um template para este tipo de recibo'),
    ).toBeInTheDocument();
  });

  it('desabilita o select enquanto grava', () => {
    updateState.isPending = true;
    render(<ReceiptTypeField template={receipt()} onChanged={vi.fn()} />);
    expect(screen.getByLabelText('Tipo de recibo')).toBeDisabled();
  });
});
