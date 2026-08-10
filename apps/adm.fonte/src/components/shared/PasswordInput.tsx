import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Classes do wrapper posicional (ex.: `flex-1` quando há botão de copiar ao lado). */
  containerClassName?: string;
}

/**
 * Campo de senha com botão "ver senha" (story 173).
 *
 * O estado começa oculto, é por instância e nunca é persistido — duas instâncias
 * na mesma tela (nova senha / confirmar senha) alternam de forma independente.
 * O botão fica fora da ordem de tabulação (`tabIndex={-1}`) para o Tab do
 * formulário continuar indo do campo direto para o próximo campo/submit.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, containerClassName, ...props }, ref) => {
    const [show, setShow] = React.useState(false);

    return (
      <div className={cn('relative', containerClassName)}>
        <Input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={cn('pr-9', className)}
          {...props}
        />
        <button
          type="button"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
