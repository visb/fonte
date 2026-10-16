import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { PopoverContent } from '@/components/ui/popover';

const FIRST_MONTH = new Date(1900, 0, 1);
const lastMonth = () => new Date(new Date().getFullYear() + 10, 11, 31);

interface DateInputCalendarProps {
  selected: Date | undefined;
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelect: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  /** Chamado ao fechar, no lugar do autofoco do Radix (o input decide o foco). */
  onCloseFocus: () => void;
  onEscape: () => void;
  /** Clique/foco fora do popover: `true` mantém aberto (ex.: no próprio campo). */
  isInsideField: (target: EventTarget | null) => boolean;
}

/**
 * Popover do `DateInput` (story 201): o calendário não rouba o foco ao abrir e
 * os dias fora de `minDate`/`maxDate` ficam desabilitados. O intervalo dos
 * dropdowns de ano vai de 1900 (ou `minDate`) até +10 anos (ou `maxDate`).
 */
export const DateInputCalendar = React.forwardRef<HTMLDivElement, DateInputCalendarProps>(
  function DateInputCalendar(
    { selected, month, onMonthChange, onSelect, minDate, maxDate, onCloseFocus, onEscape, isInsideField },
    ref,
  ) {
    const disabledDays = [
      ...(minDate ? [{ before: minDate }] : []),
      ...(maxDate ? [{ after: maxDate }] : []),
    ];
    return (
      <PopoverContent
        ref={ref}
        align="start"
        className="w-auto p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onCloseFocus();
        }}
        onEscapeKeyDown={onEscape}
        onInteractOutside={(e) => {
          if (isInsideField(e.target)) e.preventDefault();
        }}
      >
        <Calendar
          mode="single"
          required
          selected={selected}
          onSelect={onSelect}
          month={month}
          onMonthChange={onMonthChange}
          startMonth={minDate ?? FIRST_MONTH}
          endMonth={maxDate ?? lastMonth()}
          disabled={disabledDays}
        />
      </PopoverContent>
    );
  },
);
