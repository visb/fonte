import { fireEvent, render, screen } from '@testing-library/react-native';
import { IncidentSeverity } from '@fonte/types';

import { IncidentCard } from './IncidentCard';
import { SeveritySelector } from './SeveritySelector';
import { ResidentPicker } from './ResidentPicker';
import { IncidentFormFields } from './IncidentFormFields';

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
  function Harness({ responsibleName }: { responsibleName?: string }) {
    const { useForm } = require('react-hook-form');
    const { control, formState: { errors } } = useForm({
      defaultValues: { date: '2026-01-01', severity: IncidentSeverity.MEDIUM, description: '', residentId: '' },
    });
    return (
      <IncidentFormFields
        control={control}
        errors={errors}
        residents={[{ id: 'r1', name: 'João' } as never]}
        responsibleName={responsibleName}
      />
    );
  }

  it('renderiza data/severidade/descrição/picker e o responsável', () => {
    render(<Harness responsibleName="Servo X" />);
    expect(screen.getByPlaceholderText('AAAA-MM-DD')).toBeTruthy();
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
});
