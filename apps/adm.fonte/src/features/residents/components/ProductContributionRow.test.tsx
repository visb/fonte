import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FamilyInvestment, PaymentMethod } from '@fonte/types';
import { ProductContributionRow } from './ProductContributionRow';
import { paymentFormSchema, type PaymentFormValues } from './RegisterPaymentDialog';
import { emptyProductLine } from '../lib/productContributions';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';

const catalog: InventoryCatalogItem[] = [
  { id: 's1', name: 'Arroz', unit: 'kg' },
  { id: 's2', name: 'Feijão', unit: 'kg' },
];

const onSubmit = vi.fn();

/** Harness: um form com uma única linha de produto, sem valor em dinheiro. */
function Harness() {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      registerMoney: false,
      paidAt: '2026-01-01',
      paymentMethod: PaymentMethod.PIX,
      paidFamilyInvestment: FamilyInvestment.PAYMENT_700,
      paidAmount: 0,
      notes: '',
      products: [emptyProductLine()],
    },
  });
  const { fields, remove } = useFieldArray({ control: form.control, name: 'products' });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {fields.map((f, i) => (
        <ProductContributionRow
          key={f.id}
          index={i}
          register={form.register}
          control={form.control}
          setValue={form.setValue}
          catalog={catalog}
          errors={form.formState.errors.products?.[i]}
          onRemove={() => remove(i)}
        />
      ))}
      <button type="submit">enviar</button>
    </form>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('ProductContributionRow', () => {
  it('inicia no modo catálogo com o seletor de produto', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Produto do catálogo')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Arroz (kg)' })).toBeInTheDocument();
  });

  it('alterna para avulso mostrando a descrição e o aviso de pendência', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Avulso' }));
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
    expect(screen.getByText('Ficará pendente de detalhamento.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Produto do catálogo')).not.toBeInTheDocument();
  });

  it('preenche a unidade automaticamente ao escolher um item do catálogo', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Produto do catálogo'), { target: { value: 's1' } });
    expect(screen.getByText('kg')).toBeInTheDocument();
  });

  it('valida item-XOR: catálogo sem item nem quantidade acusa erro', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'enviar' }));
    await waitFor(() => {
      expect(screen.getByText('Selecione um produto')).toBeInTheDocument();
    });
    expect(screen.getByText('Quantidade deve ser maior que zero')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('valida item-XOR: avulso sem descrição acusa erro', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Avulso' }));
    fireEvent.click(screen.getByRole('button', { name: 'enviar' }));
    await waitFor(() => {
      expect(screen.getByText('Informe a descrição')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submete uma linha de catálogo válida', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Produto do catálogo'), { target: { value: 's1' } });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'enviar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0][0] as PaymentFormValues;
    expect(values.products[0]).toMatchObject({ mode: 'catalog', inventoryItemId: 's1', unit: 'kg' });
  });

  it('remove a linha ao clicar no botão de remover', () => {
    render(<Harness />);
    const row = screen.getByLabelText('Produto do catálogo').closest('div.rounded-lg') as HTMLElement;
    fireEvent.click(within(row).getByLabelText('Remover produto'));
    expect(screen.queryByLabelText('Produto do catálogo')).not.toBeInTheDocument();
  });
});
