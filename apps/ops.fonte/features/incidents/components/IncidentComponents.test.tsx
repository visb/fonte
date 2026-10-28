import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IncidentCategory, IncidentType } from '@fonte/types';
import { DATE_FIELD_MESSAGES } from '@/lib/date';
import {
  INCIDENT_CATEGORY_REQUIRED_MESSAGE as FORM_CATEGORY_REQUIRED_MESSAGE,
  INCIDENT_TYPE_REQUIRED_MESSAGE,
  incidentFormSchema,
  type IncidentFormDefaults,
  type IncidentFormData,
} from '../schema';
import { incidentCategoryLabel, INCIDENT_CATEGORY_LABELS, INCIDENT_NO_CATEGORY_LABEL } from '../constants';

import { IncidentCard, incidentTypeConfig } from './IncidentCard';
import { IncidentTypeSelector } from './IncidentTypeSelector';
import {
  IncidentCategoryPicker,
  INCIDENT_CATEGORY_NEEDS_TYPE_HINT,
  INCIDENT_CATEGORY_PLACEHOLDER,
} from './IncidentCategoryPicker';
import { ResidentMultiPicker } from './ResidentMultiPicker';
import { IncidentFormFields } from './IncidentFormFields';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

describe('IncidentCard', () => {
  const base = {
    id: 'in1',
    date: '2026-03-10',
    type: IncidentType.NEGATIVE as string,
    description: 'Briga no refeitório',
    responsible: { name: 'Servo X' },
    residents: [] as { name: string }[],
  };
  const named = (...names: string[]) => names.map((name) => ({ name }));

  it('mostra data formatada, tipo, descrição e responsável', () => {
    render(<IncidentCard item={base} />);
    expect(screen.getByText('10/03/2026')).toBeTruthy();
    expect(screen.getByText('Negativa')).toBeTruthy();
    expect(screen.getByText('icon:thumbs-down')).toBeTruthy();
    expect(screen.getByText('Briga no refeitório')).toBeTruthy();
    expect(screen.getByText('por Servo X')).toBeTruthy();
  });

  // Story 229: badge com ícone + rótulo do tipo.
  it('ocorrência positiva: badge 👍 verde "Positiva"', () => {
    render(<IncidentCard item={{ ...base, type: IncidentType.POSITIVE }} />);
    expect(screen.getByText('Positiva')).toBeTruthy();
    expect(screen.getByText('icon:thumbs-up')).toBeTruthy();
    expect(screen.getByTestId('incident-type-badge').props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#dcfce7' }),
    );
    expect(screen.queryByText('Negativa')).toBeNull();
  });

  it('sem filho (ocorrência da casa) não mostra a linha de filhos', () => {
    render(<IncidentCard item={base} />);
    expect(screen.queryByText(/^Filhos?:/)).toBeNull();
  });

  it('mostra o filho envolvido quando informado', () => {
    render(<IncidentCard item={{ ...base, residents: named('João') }} />);
    expect(screen.getByText('Filho: João')).toBeTruthy();
  });

  // Story 227: N filhos, truncado com "+N" depois do terceiro.
  it('mostra os N filhos envolvidos', () => {
    render(<IncidentCard item={{ ...base, residents: named('João', 'Pedro', 'Lucas') }} />);
    expect(screen.getByText('Filhos: João, Pedro, Lucas')).toBeTruthy();
  });

  it('passa de 3 filhos: trunca com "+N"', () => {
    render(
      <IncidentCard item={{ ...base, residents: named('João', 'Pedro', 'Lucas', 'Marcos', 'Tiago') }} />,
    );
    expect(screen.getByText('Filhos: João, Pedro, Lucas +2')).toBeTruthy();
  });

  it('cache antigo sem `residents` não quebra o card', () => {
    const { residents: _residents, ...legacy } = base;
    render(<IncidentCard item={legacy as never} />);
    expect(screen.getByText('Briga no refeitório')).toBeTruthy();
    expect(screen.queryByText(/^Filhos?:/)).toBeNull();
  });

  it('cache antigo (só severity, sem type) aparece como Negativa', () => {
    const { type: _type, ...legacy } = base;
    render(<IncidentCard item={{ ...legacy, severity: 'HIGH' } as never} />);
    expect(screen.getByText('Negativa')).toBeTruthy();
  });

  it('incidentTypeConfig: tipo desconhecido cai em Negativa', () => {
    expect(incidentTypeConfig('WEIRD').label).toBe('Negativa');
    expect(incidentTypeConfig(undefined).label).toBe('Negativa');
    expect(incidentTypeConfig(IncidentType.POSITIVE).label).toBe('Positiva');
  });

  // Story 230: categoria junto do badge de tipo.
  it('mostra a categoria junto do tipo', () => {
    render(<IncidentCard item={{ ...base, category: IncidentCategory.EVASION }} />);
    expect(screen.getByTestId('incident-category-label').props.children).toBe('Evasão ou tentativa');
  });

  it('ocorrência antiga (category null) e cache sem o campo mostram "Sem categoria"', () => {
    const { unmount } = render(<IncidentCard item={{ ...base, category: null }} />);
    expect(screen.getByText('Sem categoria')).toBeTruthy();
    unmount();
    render(<IncidentCard item={base} />);
    expect(screen.getByText('Sem categoria')).toBeTruthy();
  });
});

describe('incidentCategoryLabel (story 230)', () => {
  it('tem label para toda categoria do enum', () => {
    for (const category of Object.values(IncidentCategory)) {
      expect(INCIDENT_CATEGORY_LABELS[category]).toEqual(expect.any(String));
      expect(incidentCategoryLabel(category)).toBe(INCIDENT_CATEGORY_LABELS[category]);
    }
    expect(incidentCategoryLabel(IncidentCategory.OTHER)).toBe('Outros');
  });

  it('null, ausente ou desconhecida = "Sem categoria"', () => {
    expect(incidentCategoryLabel(null)).toBe(INCIDENT_NO_CATEGORY_LABEL);
    expect(incidentCategoryLabel(undefined)).toBe(INCIDENT_NO_CATEGORY_LABEL);
    expect(incidentCategoryLabel('WEIRD')).toBe(INCIDENT_NO_CATEGORY_LABEL);
  });
});

describe('IncidentCategoryPicker (story 230)', () => {
  const optionIds = () =>
    screen
      .getAllByRole('radio')
      .map((node) => String(node.props.testID).replace('incident-category-', ''));

  it('sem tipo: desabilitado com a dica e não abre a lista', () => {
    render(<IncidentCategoryPicker type={undefined} value={undefined} onChange={jest.fn()} />);
    expect(screen.getByText(INCIDENT_CATEGORY_NEEDS_TYPE_HINT)).toBeTruthy();
    fireEvent.press(screen.getByTestId('incident-category-trigger'));
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('negativa: só categorias negativas, "Outros" por último', () => {
    render(<IncidentCategoryPicker type={IncidentType.NEGATIVE} value={undefined} onChange={jest.fn()} />);
    expect(screen.getByText(INCIDENT_CATEGORY_PLACEHOLDER)).toBeTruthy();
    fireEvent.press(screen.getByTestId('incident-category-trigger'));
    expect(optionIds()).toEqual([
      'AGGRESSION',
      'DISRESPECT',
      'EVASION',
      'SUBSTANCE_USE',
      'ACTIVITY_REFUSAL',
      'PROPERTY_DAMAGE',
      'HEALTH',
      'OTHER',
    ]);
    expect(screen.queryByText('Bom comportamento')).toBeNull();
  });

  it('positiva: só categorias positivas, "Outros" por último', () => {
    render(<IncidentCategoryPicker type={IncidentType.POSITIVE} value={undefined} onChange={jest.fn()} />);
    fireEvent.press(screen.getByTestId('incident-category-trigger'));
    expect(optionIds()).toEqual([
      'GOOD_BEHAVIOR',
      'HELPING_OTHERS',
      'ACTIVITY_HIGHLIGHT',
      'SPIRITUAL_LIFE',
      'TREATMENT_PROGRESS',
      'OTHER',
    ]);
    expect(screen.queryByText('Agressão/briga')).toBeNull();
  });

  it('escolher dispara onChange e fecha a lista', () => {
    const onChange = jest.fn();
    render(<IncidentCategoryPicker type={IncidentType.POSITIVE} value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('incident-category-trigger'));
    fireEvent.press(screen.getByText('Vida espiritual'));
    expect(onChange).toHaveBeenCalledWith(IncidentCategory.SPIRITUAL_LIFE);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('mostra o valor escolhido marcado na lista; fechar não muda nada', () => {
    const onChange = jest.fn();
    render(
      <IncidentCategoryPicker type={IncidentType.NEGATIVE} value={IncidentCategory.HEALTH} onChange={onChange} />,
    );
    expect(screen.getByText('Saúde/mal-estar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('incident-category-trigger'));
    expect(screen.getByTestId('incident-category-HEALTH').props.accessibilityState).toEqual({
      selected: true,
      checked: true,
    });
    fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('mostra o erro quando informado', () => {
    render(
      <IncidentCategoryPicker type={IncidentType.NEGATIVE} value={undefined} onChange={jest.fn()} error="Escolha a categoria" />,
    );
    expect(screen.getByText('Escolha a categoria')).toBeTruthy();
  });
});

describe('IncidentTypeSelector (story 229)', () => {
  const radio = (name: string) => screen.getByRole('radio', { name });

  it('sem valor: nenhum marcado, ícones vazados', () => {
    render(<IncidentTypeSelector value={undefined} onChange={jest.fn()} />);
    expect(radio('Positiva').props.accessibilityState).toEqual({ selected: false, checked: false });
    expect(radio('Negativa').props.accessibilityState).toEqual({ selected: false, checked: false });
    expect(screen.getByText('icon:thumbs-up-outline')).toBeTruthy();
    expect(screen.getByText('icon:thumbs-down-outline')).toBeTruthy();
  });

  it('tocar dispara onChange com o tipo', () => {
    const onChange = jest.fn();
    render(<IncidentTypeSelector value={undefined} onChange={onChange} />);
    fireEvent.press(radio('Positiva'));
    expect(onChange).toHaveBeenCalledWith(IncidentType.POSITIVE);
    fireEvent.press(radio('Negativa'));
    expect(onChange).toHaveBeenLastCalledWith(IncidentType.NEGATIVE);
  });

  it('selecionado fica preenchido e marcado acessivelmente', () => {
    render(<IncidentTypeSelector value={IncidentType.NEGATIVE} onChange={jest.fn()} />);
    expect(radio('Negativa').props.accessibilityState).toEqual({ selected: true, checked: true });
    expect(radio('Positiva').props.accessibilityState).toEqual({ selected: false, checked: false });
    expect(screen.getByText('icon:thumbs-down')).toBeTruthy();
    expect(screen.getByText('icon:thumbs-up-outline')).toBeTruthy();
  });

  it('mostra o erro quando informado', () => {
    render(<IncidentTypeSelector value={undefined} onChange={jest.fn()} error="Escolha" />);
    expect(screen.getByText('Escolha')).toBeTruthy();
  });
});

describe('ResidentMultiPicker (story 227)', () => {
  const residents = [
    { id: 'r1', name: 'João' },
    { id: 'r2', name: 'Pedro' },
    { id: 'r3', name: 'Lucas' },
  ];
  const checkbox = (name: string) => screen.getByRole('checkbox', { name });

  it('sem seleção mostra o vazio e nenhuma caixa marcada', () => {
    render(<ResidentMultiPicker value={[]} residents={residents} onChange={jest.fn()} />);
    expect(screen.getByText('Nenhum filho selecionado')).toBeTruthy();
    expect(checkbox('João').props.accessibilityState).toEqual({ checked: false });
    expect(screen.queryByLabelText('Remover João')).toBeNull();
  });

  it('marcar acrescenta o filho à seleção (mantém os já escolhidos)', () => {
    const onChange = jest.fn();
    render(<ResidentMultiPicker value={['r1']} residents={residents} onChange={onChange} />);
    fireEvent.press(checkbox('Pedro'));
    expect(onChange).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('desmarcar tira o filho da seleção', () => {
    const onChange = jest.fn();
    render(<ResidentMultiPicker value={['r1', 'r2']} residents={residents} onChange={onChange} />);
    expect(checkbox('João').props.accessibilityState).toEqual({ checked: true });
    expect(screen.getAllByText('icon:checkbox')).toHaveLength(2);
    expect(screen.getAllByText('icon:square-outline')).toHaveLength(1);
    fireEvent.press(checkbox('João'));
    expect(onChange).toHaveBeenCalledWith(['r2']);
  });

  it('chips dos selecionados; o "x" remove', () => {
    const onChange = jest.fn();
    render(<ResidentMultiPicker value={['r3', 'r1']} residents={residents} onChange={onChange} />);
    expect(screen.queryByText('Nenhum filho selecionado')).toBeNull();
    expect(screen.getByLabelText('Remover Lucas')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Remover João'));
    expect(onChange).toHaveBeenCalledWith(['r3']);
  });

  it('id selecionado que não está mais na lista não vira chip', () => {
    render(<ResidentMultiPicker value={['gone']} residents={residents} onChange={jest.fn()} />);
    expect(screen.getByText('Nenhum filho selecionado')).toBeTruthy();
  });
});

describe('IncidentFormFields', () => {
  function Harness({
    responsibleName,
    onValid = jest.fn(),
    defaults,
  }: {
    responsibleName?: string;
    onValid?: (data: IncidentFormData) => void;
    defaults?: Partial<IncidentFormDefaults>;
  }) {
    const { useForm } = require('react-hook-form');
    const { zodResolver } = require('@hookform/resolvers/zod');
    const { Text: RNText, TouchableOpacity } = require('react-native');
    const { control, handleSubmit, formState: { errors } } = useForm({
      resolver: zodResolver(incidentFormSchema),
      defaultValues: {
        date: '2026-01-01',
        type: IncidentType.NEGATIVE,
        category: IncidentCategory.AGGRESSION,
        description: 'x',
        residentIds: [],
        ...defaults,
      },
    });
    return (
      <>
        <IncidentFormFields
          control={control}
          errors={errors}
          residents={[{ id: 'r1', name: 'João' }, { id: 'r2', name: 'Pedro' }] as never}
          responsibleName={responsibleName}
        />
        <TouchableOpacity onPress={handleSubmit(onValid)}>
          <RNText>Enviar</RNText>
        </TouchableOpacity>
      </>
    );
  }

  const dateInput = () => screen.getByLabelText('Data');

  it('renderiza data/tipo/descrição/picker e o responsável', () => {
    render(<Harness responsibleName="Servo X" />);
    expect(dateInput().props.value).toBe('01/01/2026');
    expect(screen.getByPlaceholderText('dd/mm/aaaa')).toBeTruthy();
    expect(screen.getByLabelText('Abrir calendário: Data')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Negativa' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByPlaceholderText('Descreva a ocorrência com detalhes...')).toBeTruthy();
    expect(screen.getByText('Servo X')).toBeTruthy();
  });

  it('sem responsável não renderiza o bloco', () => {
    render(<Harness />);
    expect(screen.queryByText('Responsável')).toBeNull();
  });

  it('edita a descrição via Controller', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Descreva a ocorrência com detalhes...');
    fireEvent.changeText(input, 'Algo aconteceu');
    expect(input.props.value).toBe('Algo aconteceu');
  });

  it('descrição vazia mostra o erro; sem filhos mostra o vazio do picker', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} defaults={{ description: '', residentIds: undefined }} />);
    expect(screen.getByText('Filhos envolvidos (opcional)')).toBeTruthy();
    expect(screen.getByText('Nenhum filho selecionado')).toBeTruthy();
    fireEvent.press(screen.getByText('Enviar'));
    expect(await screen.findByText('Descreva a ocorrência')).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  // Story 229: sem default — sem escolher o tipo, o form não envia.
  it('sem tipo mostra o erro e não envia; escolhendo positiva + categoria, envia type', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} defaults={{ type: undefined, category: undefined }} />);
    fireEvent.press(screen.getByText('Enviar'));
    expect(await screen.findByText(INCIDENT_TYPE_REQUIRED_MESSAGE)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('radio', { name: 'Positiva' }));
    fireEvent.press(screen.getByTestId('incident-category-trigger'));
    fireEvent.press(screen.getByTestId(`incident-category-${IncidentCategory.HELPING_OTHERS}`));
    fireEvent.press(screen.getByText('Enviar'));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0]).toMatchObject({
      type: IncidentType.POSITIVE,
      category: IncidentCategory.HELPING_OTHERS,
    });
  });

  // Story 230: categoria obrigatória; trocar o tipo limpa a categoria.
  it('sem categoria mostra o erro e não envia', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} defaults={{ category: undefined }} />);
    expect(screen.getByText(INCIDENT_CATEGORY_PLACEHOLDER)).toBeTruthy();
    fireEvent.press(screen.getByText('Enviar'));
    expect(await screen.findByText(FORM_CATEGORY_REQUIRED_MESSAGE)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('sem tipo, o picker de categoria fica desabilitado com a dica', () => {
    render(<Harness defaults={{ type: undefined, category: undefined }} />);
    expect(screen.getByText(INCIDENT_CATEGORY_NEEDS_TYPE_HINT)).toBeTruthy();
    expect(screen.getByTestId('incident-category-trigger').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('trocar o tipo limpa a categoria escolhida', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} />);
    expect(screen.getByText('Agressão/briga')).toBeTruthy();

    // Tocar no mesmo tipo não limpa.
    fireEvent.press(screen.getByRole('radio', { name: 'Negativa' }));
    expect(screen.getByText('Agressão/briga')).toBeTruthy();

    fireEvent.press(screen.getByRole('radio', { name: 'Positiva' }));
    expect(screen.queryByText('Agressão/briga')).toBeNull();
    expect(screen.getByText(INCIDENT_CATEGORY_PLACEHOLDER)).toBeTruthy();
    fireEvent.press(screen.getByText('Enviar'));
    expect(await screen.findByText(FORM_CATEGORY_REQUIRED_MESSAGE)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('seleciona 2 filhos e envia residentIds (story 227)', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} />);
    fireEvent.press(screen.getByRole('checkbox', { name: 'Pedro' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'João' }));
    expect(screen.getByLabelText('Remover Pedro')).toBeTruthy();
    fireEvent.press(screen.getByText('Enviar'));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0].residentIds).toEqual(['r2', 'r1']);
  });

  // Story 226: data com máscara + calendário, ISO no form, nunca futura.
  it('escolher a data no calendário preenche o form com a ISO', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} />);
    fireEvent.press(screen.getByLabelText('Abrir calendário: Data'));
    expect(screen.getByText('Janeiro 2026')).toBeTruthy();
    fireEvent.press(screen.getByText('15'));
    expect(dateInput().props.value).toBe('15/01/2026');
    fireEvent.press(screen.getByText('Enviar'));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0].date).toBe('2026-01-15');
  });

  it('digitar dd/mm/aaaa vira ISO no payload', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} />);
    fireEvent.changeText(dateInput(), '05032026');
    expect(dateInput().props.value).toBe('05/03/2026');
    fireEvent.press(screen.getByText('Enviar'));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0].date).toBe('2026-03-05');
  });

  it('data vazia/incompleta mostra o erro do schema e não envia', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} />);
    fireEvent.changeText(dateInput(), '05/03');
    fireEvent.press(screen.getByText('Enviar'));
    expect(await screen.findByText(DATE_FIELD_MESSAGES.required)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('data futura digitada mostra o erro do schema e não envia', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} />);
    fireEvent.changeText(dateInput(), '01012999');
    fireEvent.press(screen.getByText('Enviar'));
    expect(await screen.findByText(DATE_FIELD_MESSAGES.future)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });
});
