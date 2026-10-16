import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactElement } from 'react';
import { act, render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateInput, type DateInputProps } from './DateInput';

afterEach(() => cleanup());

type HarnessProps = Partial<DateInputProps> & { initial?: string };

function Harness({ initial = '', onChange, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="d">Data</label>
      <DateInput
        id="d"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
        {...props}
      />
      <button type="button">depois</button>
    </>
  );
}

// Monta e deixa passar o tick do mount: foco nesse instante é tratado como
// autofoco de Dialog e não abre o calendário (coberto em teste próprio).
async function mount(ui: ReactElement) {
  const result = render(ui);
  await act(() => new Promise((r) => setTimeout(r, 0)));
  return result;
}

const input = () => screen.getByLabelText('Data') as HTMLInputElement;
const dayButton = (iso: string) =>
  document.querySelector(`[data-day="${iso}"] button`) as HTMLButtonElement | null;
const monthSelect = () => screen.getByRole('combobox', { name: 'Escolha o mês' }) as HTMLSelectElement;
const yearSelect = () => screen.getByRole('combobox', { name: 'Escolha o ano' }) as HTMLSelectElement;

describe('DateInput (story 201)', () => {
  it('mostra o valor YYYY-MM-DD como dd/mm/aaaa', async () => {
    await mount(<Harness initial="2026-03-07" />);
    expect(input().value).toBe('07/03/2026');
    expect(input()).toHaveAttribute('placeholder', 'dd/mm/aaaa');
  });

  it('focar abre o calendário em pt-BR, com seletor de mês e de ano', async () => {
    await mount(<Harness initial="2026-03-07" />);
    fireEvent.focus(input());
    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'março' })).toBeInTheDocument();
    expect(yearSelect().value).toBe('2026');
    expect(monthSelect().value).toBe('2');
    expect(screen.getByText('dom')).toBeInTheDocument();
    // o dia do valor vem selecionado
    expect(dayButton('2026-03-07')?.closest('td')).toHaveAttribute('data-selected', 'true');
  });

  it('clicar no ícone abre o calendário; clicar de novo fecha', async () => {
    await mount(<Harness />);
    const icon = screen.getByRole('button', { name: 'Abrir calendário' });
    expect(icon).toHaveAttribute('tabindex', '-1');
    fireEvent.click(icon);
    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(document.activeElement).toBe(input());
    fireEvent.click(icon);
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
  });

  it('escolher um dia emite YYYY-MM-DD, fecha e devolve o foco ao input', async () => {
    const onChange = vi.fn();
    await mount(<Harness initial="2026-03-07" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }));
    await screen.findByRole('grid');
    fireEvent.click(dayButton('2026-03-15')!);
    expect(onChange).toHaveBeenLastCalledWith('2026-03-15');
    expect(input().value).toBe('15/03/2026');
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(input());
  });

  it('trocar mês e ano nos dropdowns navega o calendário', async () => {
    const onChange = vi.fn();
    await mount(<Harness initial="2026-03-07" onChange={onChange} />);
    fireEvent.focus(input());
    await screen.findByRole('grid');
    fireEvent.change(yearSelect(), { target: { value: '1975' } });
    fireEvent.change(monthSelect(), { target: { value: '7' } });
    fireEvent.click(dayButton('1975-08-20')!);
    expect(onChange).toHaveBeenLastCalledWith('1975-08-20');
  });

  it('digitar 07032026 com a máscara emite 2026-03-07', async () => {
    const onChange = vi.fn();
    await mount(<Harness onChange={onChange} />);
    await userEvent.type(input(), '07032026');
    expect(input().value).toBe('07/03/2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-03-07');
    // o calendário acompanha a data digitada
    expect(monthSelect().value).toBe('2');
  });

  it('digitação incompleta ou inválida emite vazio e mantém o texto', async () => {
    const onChange = vi.fn();
    await mount(<Harness onChange={onChange} />);
    await userEvent.type(input(), '0703');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input().value).toBe('07/03');

    fireEvent.change(input(), { target: { value: '31/02/2026' } });
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input().value).toBe('31/02/2026');
  });

  it('dias fora de min/max ficam desabilitados', async () => {
    await mount(<Harness initial="2026-03-10" min="2026-03-05" max="2026-03-20" />);
    fireEvent.focus(input());
    await screen.findByRole('grid');
    expect(dayButton('2026-03-04')).toBeDisabled();
    expect(dayButton('2026-03-21')).toBeDisabled();
    expect(dayButton('2026-03-05')).not.toBeDisabled();
    expect(dayButton('2026-03-20')).not.toBeDisabled();
  });

  it('digitar data fora do intervalo não é corrigido em silêncio', async () => {
    const onChange = vi.fn();
    await mount(<Harness max="2026-03-20" onChange={onChange} />);
    fireEvent.change(input(), { target: { value: '25/12/2030' } });
    expect(onChange).toHaveBeenLastCalledWith('2030-12-25');
  });

  it('Esc fecha o calendário', async () => {
    await mount(<Harness />);
    act(() => input().focus());
    await screen.findByRole('grid');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(input());
  });

  it('Tab sai do campo e fecha o calendário', async () => {
    await mount(<Harness />);
    act(() => input().focus());
    await screen.findByRole('grid');
    await userEvent.tab();
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'depois' }));
  });

  it('seta para baixo abre e depois leva o foco ao dia no calendário', async () => {
    await mount(<Harness initial="2026-03-07" />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }));
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    await screen.findByRole('grid');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(dayButton('2026-03-07'));
  });

  it('mês inicial: o do valor, senão o do max, senão o atual', async () => {
    const { unmount } = await mount(<Harness initial="2020-05-10" max="2024-01-15" />);
    fireEvent.focus(input());
    await screen.findByRole('grid');
    expect(yearSelect().value).toBe('2020');
    expect(monthSelect().value).toBe('4');
    unmount();

    const second = await mount(<Harness max="2024-01-15" />);
    fireEvent.focus(input());
    await screen.findByRole('grid');
    expect(yearSelect().value).toBe('2024');
    expect(monthSelect().value).toBe('0');
    second.unmount();

    await mount(<Harness />);
    fireEvent.focus(input());
    await screen.findByRole('grid');
    const now = new Date();
    expect(yearSelect().value).toBe(String(now.getFullYear()));
    expect(monthSelect().value).toBe(String(now.getMonth()));
  });

  it('foco no mesmo tick da montagem (autofoco do Dialog) não abre; clique no campo abre', async () => {
    render(<Harness />);
    fireEvent.focus(input());
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 0)));
    fireEvent.click(input());
    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });

  it('valor trocado de fora atualiza o texto exibido', () => {
    const { rerender } = render(<DateInput value="2026-03-07" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('dd/mm/aaaa')).toHaveValue('07/03/2026');
    rerender(<DateInput value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('dd/mm/aaaa')).toHaveValue('');
  });

  it('desabilitado não abre o calendário e repassa ref, name e aria-invalid', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<DateInput ref={ref} name="birthDate" value="" onChange={() => {}} disabled aria-invalid />);
    const el = screen.getByPlaceholderText('dd/mm/aaaa');
    expect(ref.current).toBe(el);
    expect(el).toHaveAttribute('name', 'birthDate');
    expect(el).toHaveAttribute('aria-invalid', 'true');
    fireEvent.focus(el);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('aceita ref por função', () => {
    const ref = vi.fn();
    render(<DateInput ref={ref} value="" onChange={() => {}} />);
    expect(ref).toHaveBeenCalledWith(screen.getByPlaceholderText('dd/mm/aaaa'));
  });
});
