import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Toaster do app (story 126) — padrão shadcn/ui sobre `sonner`.
 *
 * As cores saem dos tokens do tema (`bg-background`, `text-foreground`…), que
 * já respondem à classe `dark` no `<html>` (ver `hooks/useTheme`), então não há
 * prop de tema para sincronizar.
 *
 * Montado uma única vez na árvore de providers do `App.tsx`. Não renderizar de
 * novo por página/dialog — os toasts são disparados por `@/lib/toast`.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:border-destructive/50',
        },
      }}
      {...props}
    />
  );
}
