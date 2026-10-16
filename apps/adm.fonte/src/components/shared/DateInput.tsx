import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { dateToIso, displayToIso, isoToDate, isoToDisplay, maskDate } from '@/lib/dateMask';
import { DateInputCalendar } from './DateInputCalendar';

export interface DateInputProps {
  /** `YYYY-MM-DD` ou `''`. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Limites em `YYYY-MM-DD`: fora deles o dia fica desabilitado no calendário. */
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean;
}

/**
 * Campo de data do adm (story 201): texto com máscara `dd/mm/aaaa` + calendário
 * pt-BR num popover que abre no foco ou no ícone. O valor emitido é sempre
 * `YYYY-MM-DD` — ou `''` enquanto o texto estiver incompleto/inválido, para o
 * zod acusar. Digitação fora de `min`/`max` não é corrigida: cai no schema.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onChange, onBlur, min, max, id, name, disabled, placeholder = 'dd/mm/aaaa', className, ...aria },
  ref,
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const skipFocusOpen = React.useRef(false);
  const restoreFocus = React.useRef(false);

  const minDate = isoToDate(min);
  const maxDate = isoToDate(max);
  const initialMonth = () => isoToDate(value) ?? maxDate ?? new Date();

  const [text, setText] = React.useState(() => isoToDisplay(value));
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(initialMonth);

  // Valor trocado de fora (reset do form): reflete no texto. Texto incompleto
  // equivale a '' e, por isso, não é apagado enquanto o usuário digita.
  React.useEffect(() => {
    if (value !== displayToIso(text)) setText(isoToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setRefs = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const openCalendar = () => {
    if (disabled) return;
    setMonth(initialMonth());
    setOpen(true);
  };

  const focusInputSilently = () => {
    if (!inputRef.current || document.activeElement === inputRef.current) return;
    skipFocusOpen.current = true;
    inputRef.current.focus();
  };

  // Foco que chega junto com a montagem é o autofoco do Dialog (Radix foca o
  // primeiro campo): não abre o calendário por cima do modal recém-aberto. O
  // clique no campo continua abrindo.
  const justMounted = React.useRef(true);
  React.useEffect(() => {
    const t = setTimeout(() => {
      justMounted.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleFocus = () => {
    const skip = skipFocusOpen.current || justMounted.current;
    skipFocusOpen.current = false;
    if (!skip) openCalendar();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDate(e.target.value);
    setText(masked);
    const iso = displayToIso(masked);
    onChange(iso);
    const date = isoToDate(iso);
    if (date) setMonth(date);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') setOpen(false);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return openCalendar();
      contentRef.current?.querySelector<HTMLButtonElement>('td button[tabindex="0"]')?.focus();
    }
  };

  const handleIconClick = () => {
    if (open) return setOpen(false);
    openCalendar();
    focusInputSilently();
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = dateToIso(date);
    setText(isoToDisplay(iso));
    onChange(iso);
    restoreFocus.current = true;
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className={cn('relative', className)}>
          <Input
            ref={setRefs}
            id={id}
            name={name}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            aria-invalid={aria['aria-invalid']}
            className="pr-9"
            onChange={handleChange}
            onFocus={handleFocus}
            onClick={() => !open && openCalendar()}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            aria-label="Abrir calendário"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleIconClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:pointer-events-none"
          >
            <CalendarDays size={16} />
          </button>
        </div>
      </PopoverAnchor>
      <DateInputCalendar
        ref={contentRef}
        selected={isoToDate(value)}
        month={month}
        onMonthChange={setMonth}
        onSelect={handleSelect}
        minDate={minDate}
        maxDate={maxDate}
        onCloseFocus={() => {
          if (restoreFocus.current) focusInputSilently();
          restoreFocus.current = false;
        }}
        onEscape={() => {
          restoreFocus.current = true;
        }}
        isInsideField={(target) => !!wrapperRef.current?.contains(target as Node)}
      />
    </Popover>
  );
});
