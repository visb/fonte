import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DateInput, type DateInputProps } from './DateInput';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const LABEL = 'Data de nascimento';

/** Campo controlado, como no form: o `value` acompanha o que o `onChange` emite. */
function Controlled({
  initial = '',
  onChange,
  ...rest
}: Partial<DateInputProps> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <DateInput
      accessibilityLabel={LABEL}
      {...rest}
      value={value}
      onChange={(iso) => {
        setValue(iso);
        onChange?.(iso);
      }}
    />
  );
}

const input = () => screen.getByLabelText(LABEL);

describe('DateInput (story 209)', () => {
  it('digitar 05031985 exibe 05/03/1985 e emite a ISO', () => {
    const onChange = jest.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.changeText(input(), '05031985');
    expect(input().props.value).toBe('05/03/1985');
    expect(onChange).toHaveBeenLastCalledWith('1985-03-05');
  });

  it('teclado numérico, máximo de 10 caracteres e placeholder dd/mm/aaaa', () => {
    render(<Controlled />);
    expect(input().props.keyboardType).toBe('number-pad');
    expect(input().props.maxLength).toBe(10);
    expect(screen.getByPlaceholderText('dd/mm/aaaa')).toBeTruthy();
  });

  it('texto incompleto ou apagado emite vazio', () => {
    const onChange = jest.fn();
    render(<Controlled initial="1985-03-05" onChange={onChange} />);
    fireEvent.changeText(input(), '05/03/19');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input().props.value).toBe('05/03/19');
    fireEvent.changeText(input(), '');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input().props.value).toBe('');
  });

  it('data inexistente (31/02) emite vazio e marca inválido; corrigir desmarca', () => {
    const onChange = jest.fn();
    const onInvalidChange = jest.fn();
    render(<Controlled onChange={onChange} onInvalidChange={onInvalidChange} />);
    fireEvent.changeText(input(), '31022020');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(onInvalidChange).toHaveBeenLastCalledWith(true);
    fireEvent.changeText(input(), '28022020');
    expect(onChange).toHaveBeenLastCalledWith('2020-02-28');
    expect(onInvalidChange).toHaveBeenLastCalledWith(false);
    fireEvent.changeText(input(), '');
    expect(onInvalidChange).toHaveBeenLastCalledWith(false);
  });

  it('value inicial ISO aparece formatado', () => {
    render(<Controlled initial="2026-03-10" />);
    expect(input().props.value).toBe('10/03/2026');
  });

  it('value que muda por fora (reset do form) atualiza o texto', () => {
    const { rerender } = render(
      <DateInput accessibilityLabel={LABEL} value="2026-03-10" onChange={jest.fn()} />,
    );
    rerender(<DateInput accessibilityLabel={LABEL} value="2025-12-01" onChange={jest.fn()} />);
    expect(input().props.value).toBe('01/12/2025');
    rerender(<DateInput accessibilityLabel={LABEL} value="" onChange={jest.fn()} />);
    expect(input().props.value).toBe('');
  });

  it('o ícone abre o calendário; escolher um dia atualiza o texto e emite a ISO', () => {
    const onChange = jest.fn();
    render(<Controlled initial="1985-03-05" onChange={onChange} />);
    expect(screen.queryByText('Março 1985')).toBeNull();
    fireEvent.press(screen.getByLabelText(`Abrir calendário: ${LABEL}`));
    expect(screen.getByText('Março 1985')).toBeTruthy();
    fireEvent.press(screen.getByText('20'));
    expect(onChange).toHaveBeenLastCalledWith('1985-03-20');
    expect(input().props.value).toBe('20/03/1985');
    // Escolher fecha o calendário.
    expect(screen.queryByText('Março 1985')).toBeNull();
  });

  it('digitar uma data válida leva o calendário para o mês dela', () => {
    render(<Controlled />);
    fireEvent.changeText(input(), '15/08/1990');
    fireEvent.press(screen.getByLabelText(`Abrir calendário: ${LABEL}`));
    expect(screen.getByText('Agosto 1990')).toBeTruthy();
  });

  it('o calendário respeita maxDate/minDate (dias fora ficam bloqueados)', () => {
    const onChange = jest.fn();
    render(
      <Controlled
        initial="2026-03-15"
        minDate="2026-03-10"
        maxDate="2026-03-20"
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByLabelText(`Abrir calendário: ${LABEL}`));
    expect(screen.getByLabelText('Próximo mês').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText('Mês anterior').props.accessibilityState?.disabled).toBe(true);
    // Dia bloqueado não seleciona (o toque cai no fundo, que fecha o calendário).
    fireEvent.press(screen.getByText('25'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText(`Abrir calendário: ${LABEL}`));
    fireEvent.press(screen.getByText('5'));
    expect(onChange).not.toHaveBeenCalled();
    expect(input().props.value).toBe('15/03/2026');
  });

  it('fechar o calendário sem escolher mantém o valor', () => {
    const onChange = jest.fn();
    const { Modal } = require('react-native');
    render(<Controlled initial="1985-03-05" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText(`Abrir calendário: ${LABEL}`));
    const pickerModal = screen.UNSAFE_getAllByType(Modal).at(-1)!;
    fireEvent(pickerModal, 'requestClose');
    expect(screen.queryByText('Março 1985')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(input().props.value).toBe('05/03/1985');
  });

  it('mostra o erro recebido e repassa o onBlur', () => {
    const onBlur = jest.fn();
    render(<Controlled error="Data inválida" onBlur={onBlur} />);
    expect(screen.getByText('Data inválida')).toBeTruthy();
    fireEvent(input(), 'blur');
    expect(onBlur).toHaveBeenCalled();
  });
});
