import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { WheelDatePickerModal } from './WheelDatePickerModal';

function scrollEnd(node: unknown, y: number) {
  fireEvent(node as never, 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { y }, contentSize: { height: 0 }, layoutMeasurement: { height: 0 } },
  });
}

describe('WheelDatePickerModal', () => {
  it('não-visível não renderiza conteúdo', () => {
    render(
      <WheelDatePickerModal
        visible={false}
        date={new Date('2024-06-10T00:00:00')}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText('Selecionar data')).toBeNull();
  });

  it('visível renderiza colunas (dia/mês/ano) e título', () => {
    render(
      <WheelDatePickerModal
        visible
        date={new Date('2024-06-10T00:00:00')}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Selecionar data')).toBeTruthy();
    expect(screen.getByText('Junho')).toBeTruthy();
    expect(screen.getByText('2024')).toBeTruthy();
  });

  it('Confirmar devolve a data selecionada', () => {
    const onConfirm = jest.fn();
    render(
      <WheelDatePickerModal
        visible
        date={new Date('2024-06-10T00:00:00')}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText('Confirmar'));
    const arg = onConfirm.mock.calls[0][0] as Date;
    expect(arg.getFullYear()).toBe(2024);
    expect(arg.getMonth()).toBe(5);
    expect(arg.getDate()).toBe(10);
  });

  it('Cancelar dispara onCancel', () => {
    const onCancel = jest.fn();
    render(
      <WheelDatePickerModal
        visible
        date={new Date('2024-06-10T00:00:00')}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('scroll nas colunas atualiza e clampa o índice selecionado', () => {
    const onConfirm = jest.fn();
    render(
      <WheelDatePickerModal
        visible
        date={new Date('2024-06-10T00:00:00')}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    const columns = screen.UNSAFE_getAllByType(ScrollView);
    // Coluna do dia: rola para um índice gigante → clamp no último dia de junho (índice 29).
    scrollEnd(columns[0], 44 * 999);
    // Coluna do mês: rola para o índice 0 (Janeiro).
    scrollEnd(columns[1], 0);
    fireEvent.press(screen.getByText('Confirmar'));
    const arg = onConfirm.mock.calls[0][0] as Date;
    expect(arg.getMonth()).toBe(0);
    expect(arg.getDate()).toBe(30);
  });
});
