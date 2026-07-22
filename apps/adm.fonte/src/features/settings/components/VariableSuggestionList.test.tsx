import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  VariableSuggestionList,
  type VariableSuggestionListRef,
} from './VariableSuggestionList';
import type { TemplateVariable } from './templateVariables';

afterEach(() => cleanup());

const items: TemplateVariable[] = [
  { key: '{{name}}', label: 'Nome completo', description: 'x' },
  { key: '{{cpf}}', label: 'CPF', description: 'y' },
  { key: '{{rg}}', label: 'RG', description: 'z' },
];

function key(k: string) {
  return { event: new KeyboardEvent('keydown', { key: k }) };
}

describe('VariableSuggestionList', () => {
  it('renderiza rótulo + chave de cada item', () => {
    render(<VariableSuggestionList items={items} command={vi.fn()} />);
    expect(screen.getByText('Nome completo')).toBeInTheDocument();
    expect(screen.getByText('{{name}}')).toBeInTheDocument();
    expect(screen.getByText('CPF')).toBeInTheDocument();
  });

  it('lista vazia → não renderiza nada', () => {
    const { container } = render(<VariableSuggestionList items={[]} command={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('o primeiro item nasce ativo (data-active)', () => {
    render(<VariableSuggestionList items={items} command={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('data-active', 'true');
    expect(buttons[1]).toHaveAttribute('data-active', 'false');
  });

  it('clicar num item chama command com a variável', () => {
    const command = vi.fn();
    render(<VariableSuggestionList items={items} command={command} />);
    fireEvent.click(screen.getByText('CPF'));
    expect(command).toHaveBeenCalledWith(items[1]);
  });

  it('mouseenter destaca o item sob o ponteiro', () => {
    render(<VariableSuggestionList items={items} command={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.mouseEnter(buttons[2]);
    expect(buttons[2]).toHaveAttribute('data-active', 'true');
    expect(buttons[0]).toHaveAttribute('data-active', 'false');
  });

  it('teclado: ↓ avança, ↑ recua (com wrap) e Enter confirma o ativo', () => {
    const command = vi.fn();
    const ref = createRef<VariableSuggestionListRef>();
    render(<VariableSuggestionList ref={ref} items={items} command={command} />);

    // ↓ move o destaque para o 2º item.
    let handled = false;
    act(() => { handled = ref.current!.onKeyDown(key('ArrowDown')); });
    expect(handled).toBe(true);
    expect(screen.getAllByRole('button')[1]).toHaveAttribute('data-active', 'true');

    // ↑ duas vezes: 2 → 1 → 3 (wrap para o fim).
    act(() => { ref.current!.onKeyDown(key('ArrowUp')); });
    act(() => { ref.current!.onKeyDown(key('ArrowUp')); });
    expect(screen.getAllByRole('button')[2]).toHaveAttribute('data-active', 'true');

    // Enter confirma o item ativo (o 3º).
    act(() => { handled = ref.current!.onKeyDown(key('Enter')); });
    expect(handled).toBe(true);
    expect(command).toHaveBeenCalledWith(items[2]);
  });

  it('Tab também confirma o item ativo', () => {
    const command = vi.fn();
    const ref = createRef<VariableSuggestionListRef>();
    render(<VariableSuggestionList ref={ref} items={items} command={command} />);
    let handled = false;
    act(() => { handled = ref.current!.onKeyDown(key('Tab')); });
    expect(handled).toBe(true);
    expect(command).toHaveBeenCalledWith(items[0]);
  });

  it('outras teclas → false (não consumidas)', () => {
    const ref = createRef<VariableSuggestionListRef>();
    render(<VariableSuggestionList ref={ref} items={items} command={vi.fn()} />);
    let handled = true;
    act(() => { handled = ref.current!.onKeyDown(key('a')); });
    expect(handled).toBe(false);
  });

  it('lista vazia → onKeyDown sempre false (nada a navegar)', () => {
    const ref = createRef<VariableSuggestionListRef>();
    render(<VariableSuggestionList ref={ref} items={[]} command={vi.fn()} />);
    let down = true;
    let enter = true;
    act(() => { down = ref.current!.onKeyDown(key('ArrowDown')); });
    act(() => { enter = ref.current!.onKeyDown(key('Enter')); });
    expect(down).toBe(false);
    expect(enter).toBe(false);
  });
});
