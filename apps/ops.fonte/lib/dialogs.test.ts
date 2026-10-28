import { Alert, Platform } from 'react-native';
import { confirmAction, notify } from './dialogs';

describe('dialogs', () => {
  const originalOS = Platform.OS;
  const originalWindow = (globalThis as { window?: unknown }).window;

  function mockWeb(win: Record<string, jest.Mock>) {
    Platform.OS = 'web';
    (globalThis as { window?: unknown }).window = win;
  }

  afterEach(() => {
    Platform.OS = originalOS;
    (globalThis as { window?: unknown }).window = originalWindow;
    jest.restoreAllMocks();
  });

  describe('confirmAction', () => {
    it('no nativo abre Alert com cancelar + confirmar', () => {
      Platform.OS = 'android';
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const onConfirm = jest.fn();

      confirmAction({ title: 'T', message: 'M', confirmText: 'OK', destructive: true, onConfirm });

      const buttons = alert.mock.calls[0][2]!;
      expect(alert).toHaveBeenCalledWith('T', 'M', expect.any(Array));
      expect(buttons[0]).toMatchObject({ text: 'Cancelar', style: 'cancel' });
      expect(buttons[1]).toMatchObject({ text: 'OK', style: 'destructive' });
      buttons[1].onPress!();
      expect(onConfirm).toHaveBeenCalled();
    });

    it('no nativo sem destructive usa estilo default', () => {
      Platform.OS = 'android';
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      confirmAction({ title: 'T', confirmText: 'OK', onConfirm: jest.fn() });

      expect(alert.mock.calls[0][2]![1]).toMatchObject({ style: 'default' });
    });

    it('na web usa window.confirm e só confirma no OK', () => {
      const confirm = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockWeb({ confirm });
      const onConfirm = jest.fn();

      confirmAction({ title: 'T', message: 'M', confirmText: 'OK', onConfirm });
      confirmAction({ title: 'T', confirmText: 'OK', onConfirm });

      expect(confirm).toHaveBeenNthCalledWith(1, 'T\n\nM');
      expect(confirm).toHaveBeenNthCalledWith(2, 'T');
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('notify', () => {
    it('no nativo sem onDismiss abre Alert simples', () => {
      Platform.OS = 'android';
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      notify('T', 'M');

      expect(alert).toHaveBeenCalledWith('T', 'M');
    });

    it('no nativo com onDismiss chama ao tocar OK', () => {
      Platform.OS = 'android';
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const onDismiss = jest.fn();

      notify('T', 'M', onDismiss);

      const buttons = alert.mock.calls[0][2]!;
      expect(buttons[0].text).toBe('OK');
      buttons[0].onPress!();
      expect(onDismiss).toHaveBeenCalled();
    });

    it('na web usa window.alert e chama onDismiss depois', () => {
      const alert = jest.fn();
      mockWeb({ alert });
      const onDismiss = jest.fn();

      notify('T', 'M', onDismiss);
      notify('Só título');

      expect(alert).toHaveBeenNthCalledWith(1, 'T\n\nM');
      expect(alert).toHaveBeenNthCalledWith(2, 'Só título');
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
