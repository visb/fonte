import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReceivableProductContribution } from '@fonte/api-client';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import {
  productContributionFormSchema,
  emptyProductLine,
  type ProductContributionFormValues,
} from '../lib/productContributions';
import { ProductContributionRow } from './ProductContributionRow';
import { ProductContributionList } from './ProductContributionList';
import { CatalogProductPicker } from './CatalogProductPicker';
import { ResidentOverviewTab } from './ResidentOverviewTab';

const catalog = [
  { id: 'i1', name: 'Arroz', unit: 'kg' },
  { id: 'i2', name: 'Feijão', unit: 'kg' },
];

/** Harness que embrulha a Row num form real (RHF + zod + useFieldArray). */
function RowHarness({ onValid }: { onValid?: (v: ProductContributionFormValues) => void }) {
  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductContributionFormValues>({
    resolver: zodResolver(productContributionFormSchema),
    defaultValues: { products: [emptyProductLine()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'products' });
  return (
    <>
      {fields.map((f, index) => (
        <ProductContributionRow
          key={f.id}
          index={index}
          control={control}
          setValue={setValue}
          catalog={catalog}
          errors={errors.products?.[index]}
          onRemove={() => remove(index)}
        />
      ))}
      <Btn label="add" onPress={() => append(emptyProductLine())} />
      <Btn label="submit" onPress={handleSubmit((v) => onValid?.(v))} />
    </>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  const { Text, TouchableOpacity } = require('react-native');
  return (
    <TouchableOpacity accessibilityLabel={label} onPress={onPress}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
}

describe('ProductContributionRow — toggle catálogo/avulso', () => {
  it('inicia no catálogo e alterna para avulso', () => {
    render(<RowHarness />);
    // catálogo: busca de produto visível
    expect(screen.getByPlaceholderText('Buscar produto...')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Avulso'));
    // avulso: campo de descrição visível, busca some
    expect(screen.getByPlaceholderText('Descrição (ex: cesta básica)')).toBeTruthy();
    expect(screen.getByText('Ficará pendente de detalhamento.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Buscar produto...')).toBeNull();
  });

  it('valida item-XOR-descrição: catálogo vazio bloqueia e mostra erros', async () => {
    const onValid = jest.fn();
    render(<RowHarness onValid={onValid} />);
    fireEvent.press(screen.getByLabelText('submit'));
    expect(await screen.findByText('Selecione um produto')).toBeTruthy();
    expect(screen.getByText('Quantidade deve ser maior que zero')).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('avulso vazio mostra erro de descrição', async () => {
    render(<RowHarness />);
    fireEvent.press(screen.getByLabelText('Avulso'));
    fireEvent.press(screen.getByLabelText('submit'));
    expect(await screen.findByText('Informe a descrição')).toBeTruthy();
  });

  it('avulso só com descrição é válido', async () => {
    const onValid = jest.fn();
    render(<RowHarness onValid={onValid} />);
    fireEvent.press(screen.getByLabelText('Avulso'));
    fireEvent.changeText(screen.getByPlaceholderText('Descrição (ex: cesta básica)'), 'cesta');
    fireEvent.press(screen.getByLabelText('submit'));
    await waitFor(() =>
      expect(onValid).toHaveBeenCalledWith({
        products: [expect.objectContaining({ mode: 'avulso', description: 'cesta' })],
      }),
    );
  });

  it('selecionar produto do catálogo + quantidade é válido e preenche a unidade', async () => {
    const onValid = jest.fn();
    render(<RowHarness onValid={onValid} />);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar produto...'), 'Arroz');
    fireEvent.press(screen.getByText('Arroz (kg)'));
    fireEvent.changeText(screen.getByLabelText('Quantidade'), '3');
    fireEvent.press(screen.getByLabelText('submit'));
    await waitFor(() =>
      expect(onValid).toHaveBeenCalledWith({
        products: [
          expect.objectContaining({
            mode: 'catalog',
            inventoryItemId: 'i1',
            quantity: '3',
            unit: 'kg',
          }),
        ],
      }),
    );
  });

  it('useFieldArray adiciona e remove linhas', () => {
    render(<RowHarness />);
    expect(screen.getAllByLabelText('Do catálogo')).toHaveLength(1);
    fireEvent.press(screen.getByLabelText('add'));
    expect(screen.getAllByLabelText('Do catálogo')).toHaveLength(2);
    fireEvent.press(screen.getAllByLabelText('Remover produto')[0]);
    expect(screen.getAllByLabelText('Do catálogo')).toHaveLength(1);
  });
});

describe('CatalogProductPicker', () => {
  it('filtra por busca e devolve o item selecionado', () => {
    const onSelect = jest.fn();
    render(<CatalogProductPicker value="" items={catalog} onSelect={onSelect} />);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar produto...'), 'fei');
    expect(screen.queryByText('Arroz (kg)')).toBeNull();
    fireEvent.press(screen.getByText('Feijão (kg)'));
    expect(onSelect).toHaveBeenCalledWith({ id: 'i2', name: 'Feijão', unit: 'kg' });
  });

  it('mostra o item selecionado e permite trocar', () => {
    const onSelect = jest.fn();
    render(<CatalogProductPicker value="i1" items={catalog} onSelect={onSelect} />);
    expect(screen.getByText('Arroz (kg)')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Produto selecionado'));
    expect(screen.getByPlaceholderText('Buscar produto...')).toBeTruthy();
  });

  it('exibe o erro e o placeholder de carregando', () => {
    render(<CatalogProductPicker value="" items={[]} loading error="Selecione um produto" onSelect={jest.fn()} />);
    expect(screen.getByPlaceholderText('Carregando catálogo...')).toBeTruthy();
    expect(screen.getByText('Selecione um produto')).toBeTruthy();
  });
});

describe('ProductContributionList', () => {
  function makeContribution(o: Partial<ReceivableProductContribution> = {}): ReceivableProductContribution {
    return {
      id: 'pc1',
      receivableId: 'rc1',
      inventoryItemId: null,
      inventoryMovementId: null,
      description: null,
      quantity: null,
      unit: null,
      pendingDetailing: false,
      createdByName: null,
      createdAt: '2026-01-01',
      ...o,
    };
  }

  it('não renderiza nada quando vazio', () => {
    const { toJSON } = render(<ProductContributionList contributions={[]} catalog={catalog} />);
    expect(toJSON()).toBeNull();
  });

  it('mostra nome do catálogo com quantidade e unidade', () => {
    render(
      <ProductContributionList
        contributions={[makeContribution({ inventoryItemId: 'i1', quantity: 2, unit: 'kg' })]}
        catalog={catalog}
      />,
    );
    expect(screen.getByText('Arroz')).toBeTruthy();
    expect(screen.getByText('· 2 kg')).toBeTruthy();
  });

  it('avulso mostra descrição e badge Pendente', () => {
    render(
      <ProductContributionList
        contributions={[makeContribution({ description: 'cesta básica', pendingDetailing: true })]}
        catalog={catalog}
      />,
    );
    expect(screen.getByText('cesta básica')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
  });

  it('item de catálogo desconhecido cai no rótulo genérico', () => {
    render(
      <ProductContributionList
        contributions={[makeContribution({ inventoryItemId: 'zzz' })]}
        catalog={catalog}
      />,
    );
    expect(screen.getByText('Produto do catálogo')).toBeTruthy();
  });
});

describe('ResidentOverviewTab — entrada de contribuição', () => {
  const resident = { id: 'r1', name: 'João', houseId: 'h1' } as never;

  it('botão de declarar produtos dispara o callback', () => {
    const onDeclareProducts = jest.fn();
    render(
      <ResidentOverviewTab
        resident={resident}
        onChangeMinistry={jest.fn()}
        onResetPassword={jest.fn()}
        onDeclareProducts={onDeclareProducts}
      />,
    );
    fireEvent.press(screen.getByLabelText('Declarar contribuição de produtos'));
    expect(onDeclareProducts).toHaveBeenCalled();
  });
});
