import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IncidentSeverity } from '@fonte/types';
import { DATE_FIELD_MESSAGES } from '@/lib/date';
import { incidentFormSchema, type IncidentFormData } from '../schema';

import { IncidentCard } from './IncidentCard';
import { SeveritySelector } from './SeveritySelector';
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
    severity: 'HIGH',
    description: 'Briga no refeitório',
    responsible: { name: 'Servo X' },
    residents: [] as { name: string }[],
  };
  const named = (...names: string[]) => names.map((name) => ({ name }));

  it('mostra data formatada, severidade, descrição e responsável', () => {
    render(<IncidentCard item={base} />);
    expect(screen.getByText('10/03/2026')).toBeTruthy();
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.getByText('Briga no refeitório')).toBeTruthy();
    expect(screen.getByText('por Servo X')).toBeTruthy();
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

  it('severidade desconhecida cai no fallback (mostra o código)', () => {
    render(<IncidentCard item={{ ...base, severity: 'WEIRD' }} />);
    expect(screen.getByText('WEIRD')).toBeTruthy();
  });
});

describe('SeveritySelector', () => {
  it('renderiza todas as severidades e dispara onChange', () => {
    const onChange = jest.fn();
    render(<SeveritySelector value={IncidentSeverity.LOW} onChange={onChange} />);
    expect(screen.getByText('Baixa')).toBeTruthy();
    expect(screen.getByText('Crítica')).toBeTruthy();
    fireEvent.press(screen.getByText('Alta'));
    expect(onChange).toHaveBeenCalledWith(IncidentSeverity.HIGH);
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
    defaults?: Partial<IncidentFormData>;
  }) {
    const { useForm } = require('react-hook-form');
    const { zodResolver } = require('@hookform/resolvers/zod');
    const { Text: RNText, TouchableOpacity } = require('react-native');
    const { control, handleSubmit, formState: { errors } } = useForm({
      resolver: zodResolver(incidentFormSchema),
      defaultValues: {
        date: '2026-01-01',
        severity: IncidentSeverity.MEDIUM,
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

  it('renderiza data/severidade/descrição/picker e o responsável', () => {
    render(<Harness responsibleName="Servo X" />);
    expect(dateInput().props.value).toBe('01/01/2026');
    expect(screen.getByPlaceholderText('dd/mm/aaaa')).toBeTruthy();
    expect(screen.getByLabelText('Abrir calendário: Data')).toBeTruthy();
    expect(screen.getByText('Média')).toBeTruthy();
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
