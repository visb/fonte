import * as React from 'react';
import { DayPicker, type ChevronProps } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon =
    orientation === 'left' ? ChevronLeft : orientation === 'right' ? ChevronRight : ChevronDown;
  return <Icon className={cn('size-4', className)} />;
}

/**
 * Calendar no padrão do shadcn (react-day-picker), em pt-BR: semana começa no
 * domingo e mês/ano escolhidos por dropdown (story 201). As classes substituem o
 * CSS do react-day-picker, que não é importado.
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      captionLayout="dropdown"
      navLayout="around"
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        root: 'w-fit',
        months: 'relative flex flex-col gap-4',
        month: 'flex w-full flex-col gap-4',
        nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8 p-0'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8 p-0'),
        month_caption: 'flex h-8 w-full items-center justify-center px-8',
        dropdowns: 'flex h-8 w-full items-center justify-center gap-1.5 text-sm font-medium',
        dropdown_root:
          'relative rounded-md border border-input has-[:focus]:ring-2 has-[:focus]:ring-ring',
        dropdown: 'absolute inset-0 w-full cursor-pointer bg-popover opacity-0',
        caption_label:
          'flex h-8 select-none items-center gap-1 rounded-md pl-2 pr-1 text-sm font-medium capitalize',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 select-none text-[0.8rem] font-normal capitalize text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'h-9 w-9 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50 [&>button]:cursor-not-allowed',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{ Chevron: CalendarChevron }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
