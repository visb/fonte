import { render, screen, fireEvent } from '@testing-library/react-native';
import { RecordingBar } from './RecordingBar';

describe('RecordingBar', () => {
  it('formata os segundos como mm:ss', () => {
    render(<RecordingBar seconds={75} onCancel={jest.fn()} />);
    expect(screen.getByText('Gravando... 01:15')).toBeOnTheScreen();
  });

  it('zera-pad em durações curtas', () => {
    render(<RecordingBar seconds={5} onCancel={jest.fn()} />);
    expect(screen.getByText('Gravando... 00:05')).toBeOnTheScreen();
  });

  it('dispara onCancel ao tocar no lixo', () => {
    const onCancel = jest.fn();
    render(<RecordingBar seconds={3} onCancel={onCancel} />);
    fireEvent.press(screen.getByLabelText('Ionicons:trash-outline'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
