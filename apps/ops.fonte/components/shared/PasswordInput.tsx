import { useState } from 'react';
import { TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  /** Classes NativeWind do campo — cada tela passa o seu `INPUT_CLASS`. */
  className?: string;
}

/**
 * Campo de senha com botão "ver senha" (story 173).
 *
 * Controlado (`value`/`onChangeText`/`onBlur`) para plugar direto no `render` do
 * `Controller` sem inverter a responsabilidade do formulário — o valor é do
 * form, o toggle é só apresentação.
 *
 * O estado começa oculto, é por instância e nunca é persistido: revelar "nova
 * senha" não revela "confirmar senha", e nada sobrevive à saída da tela (a tela
 * é usada em ambiente coletivo).
 *
 * O `accessibilityLabel` do campo é repassado intacto — `input-senha` é o gancho
 * dos e2e (Maestro e Playwright web) e não pode mudar.
 */
export function PasswordInput({ className, style, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <View className="relative justify-center">
      <TextInput
        {...props}
        className={className}
        // Espaço à direita para o texto não passar por baixo do ícone.
        style={[{ paddingRight: 44 }, style]}
        secureTextEntry={!show}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={show ? 'ocultar-senha' : 'mostrar-senha'}
        onPress={() => setShow((v) => !v)}
        className="absolute right-0 top-0 bottom-0 justify-center px-3"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
}
