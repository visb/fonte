import { fireEvent, render, screen } from '@testing-library/react-native';
import { MovementType } from '@fonte/types';
import { NotesField } from './NotesField';
import { QuantityField } from './QuantityField';
import { ResponsibleDisplay } from './ResponsibleDisplay';
import { SubmitMovementButton } from './SubmitMovementButton';

describe('supply-room/NotesField', () => {
  it('propaga texto digitado', () => {
    const onChange = jest.fn();
    render(<NotesField value="" onChange={onChange} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(/compra do mercado/),
      'uso na limpeza',
    );
    expect(onChange).toHaveBeenCalledWith('uso na limpeza');
  });
});

describe('supply-room/QuantityField', () => {
  it('usa a unidade informada no rótulo e propaga mudança', () => {
    const onChange = jest.fn();
    render(<QuantityField value="3" unit="L" onChange={onChange} />);
    expect(screen.getByText(/Quantidade \(L\)/)).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '5');
    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('usa "unid." como fallback e mostra erro', () => {
    render(<QuantityField value="" onChange={jest.fn()} error="obrigatório" />);
    expect(screen.getByText(/Quantidade \(unid\.\)/)).toBeTruthy();
    expect(screen.getByText('obrigatório')).toBeTruthy();
  });
});

describe('supply-room/ResponsibleDisplay', () => {
  it('mostra o nome quando informado', () => {
    render(<ResponsibleDisplay name="Servo X" />);
    expect(screen.getByText('Servo X')).toBeTruthy();
  });

  it('mostra travessão quando ausente', () => {
    render(<ResponsibleDisplay />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('supply-room/SubmitMovementButton', () => {
  it('rótulo "entrada" e dispara onPress quando não pendente', () => {
    const onPress = jest.fn();
    render(<SubmitMovementButton type={MovementType.IN} isPending={false} onPress={onPress} />);
    fireEvent.press(screen.getByText('Registrar entrada'));
    expect(onPress).toHaveBeenCalled();
  });

  it('rótulo "saída" para MovementType.OUT', () => {
    render(<SubmitMovementButton type={MovementType.OUT} isPending={false} onPress={jest.fn()} />);
    expect(screen.getByText('Registrar saída')).toBeTruthy();
  });

  it('pendente mostra spinner e oculta o rótulo', () => {
    render(<SubmitMovementButton type={MovementType.IN} isPending onPress={jest.fn()} />);
    expect(screen.queryByText('Registrar entrada')).toBeNull();
  });
});
