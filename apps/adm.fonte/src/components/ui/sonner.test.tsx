import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { Toaster } from './sonner';

// O sonner só monta a `<ol data-sonner-toaster>` (a que recebe as classes do
// tema) quando existe algum toast vivo — por isso os asserts de classe/posição
// disparam um toast antes de olhar o DOM.
afterEach(() => {
  toast.dismiss();
  cleanup();
});

async function toaster(): Promise<HTMLElement> {
  return waitFor(() => {
    const list = document.querySelector('[data-sonner-toaster]');
    expect(list).toBeTruthy();
    return list as HTMLElement;
  });
}

describe('Toaster', () => {
  it('monta a região de toasts mesmo sem toast na tela', () => {
    render(<Toaster />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('renderiza o toast disparado imperativamente com as classes do tema', async () => {
    render(<Toaster />);
    toast.success('Turma criada.');

    expect(await screen.findByText('Turma criada.')).toBeInTheDocument();
    expect(await toaster()).toHaveClass('toaster', 'group');
  });

  it('usa top-right por padrão', async () => {
    render(<Toaster />);
    toast.success('Turma criada.');

    const list = await toaster();
    expect(list).toHaveAttribute('data-y-position', 'top');
    expect(list).toHaveAttribute('data-x-position', 'right');
  });

  it('aceita override de props (ex.: position)', async () => {
    render(<Toaster position="bottom-left" />);
    toast.success('Turma criada.');

    const list = await toaster();
    expect(list).toHaveAttribute('data-y-position', 'bottom');
    expect(list).toHaveAttribute('data-x-position', 'left');
  });
});
