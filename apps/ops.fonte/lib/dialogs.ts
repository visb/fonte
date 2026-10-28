import { Alert, Platform } from 'react-native';

/*
 * Diálogos cross-platform. No react-native-web `Alert.alert` é um stub vazio:
 * não abre nada nem chama os `onPress` dos botões. Na web caímos no
 * `window.confirm`/`window.alert`; no nativo segue o `Alert` de sempre.
 */

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

function webText(title: string, message?: string) {
  return message ? `${title}\n\n${message}` : title;
}

/** Confirmação com "Cancelar" + ação. */
export function confirmAction({
  title, message, confirmText, cancelText = 'Cancelar', destructive, onConfirm,
}: ConfirmOptions) {
  if (Platform.OS === 'web') {
    if (window.confirm(webText(title, message))) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Aviso informativo; `onDismiss` roda quando o usuário fecha (botão "OK"). */
export function notify(title: string, message?: string, onDismiss?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(webText(title, message));
    onDismiss?.();
    return;
  }
  if (onDismiss) Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
  else Alert.alert(title, message);
}
