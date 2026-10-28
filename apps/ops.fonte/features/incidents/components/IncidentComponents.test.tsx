import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IncidentSeverity } from '@fonte/types';
import { DATE_FIELD_MESSAGES } from '@/lib/date';
import { incidentFormSchema, type IncidentFormData } from '../schema';

import { IncidentCard } from './IncidentCard';
import { SeveritySelector } from './SeveritySelector';
import { ResidentPicker } from './ResidentPicker';
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
    resident: null,
  };

  it('mostra data formatada, severidade, descrição e responsável', () => {
    render(<IncidentCard item={base} />);
    expect(screen.getByText('10/03/2026')).toBeTruthy();
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.getByText('Briga no refeitório')).toBeTruthy();
    expect(screen.getByText('por Servo X')).toBeTruthy();
  });

  it('mostra o filho envolvido quando informado', () => {
    render(<IncidentCard item={{ ...base, resident: { name: 'João' } }} />);
    expect(screen.getByText('Filho: João')).toBeTruthy();
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

describe('ResidentPicker', () => {
  const residents = [
    { id: 'r1', name: 'João' },
    { id: 'r2', name: 'Pedro' },
  ];

  it('sem valor mostra "Nenhum específico"', () => {
    render(<ResidentPicker value="" residents={residents} onChange={jest.fn()} />);
    expect(screen.getByText('Nenhum específico')).toBeTruthy();
  });

  it('seleciona um residente', () => {
    const onChange = jest.fn();
    render(<ResidentPicker value="" residents={residents} onChange={onChange} />);
    fireEvent.press(screen.getByText('Pedro'));
    expect(onChange).toHaveBeenCalledWith('r2');
  });

  it('limpar volta a "" ao tocar no cabeçalho com valor', () => {
    const onChange = jest.fn();
    render(<ResidentPicker value="r1" residents={residents} onChange={onChange} />);
    // o header mostra o nome selecionado (João aparece no header e no item da lista);
    // o primeiro é o cabeçalho, que limpa a seleção.
    fireEvent.press(screen.getAllByText('João')[0]);
    expect(onChange).toHaveBeenCalledWith('');
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
        residentId: '',
        ...defaults,
      },
    });
    return (
      <>
        <IncidentFormFields
          control={control}
          errors={errors}
          residents={[{ id: 'r1', name: 'João' } as never]}
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

  it('descrição vazia mostra o erro; residentId ausente vira "Nenhum específico"', async () => {
    const onValid = jest.fn();
    render(<Harness onValid={onValid} defaults={{ description: '', residentId: undefined }} />);
    expect(screen.getByText('Nenhum específico')).toBeTruthy();
    fireEvent.press(screen.getByText('Enviar'));
    expect(await screen.findByText('Descreva a ocorrência')).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
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
