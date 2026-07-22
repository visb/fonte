import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VariablesPanel, VARIABLES } from './VariablesPanel';

afterEach(() => cleanup());

describe('VariablesPanel', () => {
  beforeEach(() => {
    // jsdom não implementa navigator.clipboard — mockamos p/ exercitar a cópia.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  it('inicia recolhido: só a aba "Variáveis", sem a lista', () => {
    render(<VariablesPanel onInsert={vi.fn()} />);
    // A aba de abrir existe...
    expect(screen.getByRole('button', { name: /Variáveis/i })).toBeInTheDocument();
    // ...mas nenhuma variável está renderizada (lista escondida).
    expect(screen.queryByText('{{name}}')).not.toBeInTheDocument();
    expect(screen.queryByText('Nome completo')).not.toBeInTheDocument();
  });

  it('expande ao clicar na aba e recolhe de volta', () => {
    render(<VariablesPanel onInsert={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Variáveis/i }));
    // Lista visível após expandir.
    expect(screen.getByText('{{name}}')).toBeInTheDocument();
    expect(screen.getByText('Nome completo')).toBeInTheDocument();

    // Recolher volta ao estado inicial (lista some).
    fireEvent.click(screen.getByRole('button', { name: /Recolher variáveis/i }));
    expect(screen.queryByText('{{name}}')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Variáveis/i })).toBeInTheDocument();
  });

  it('o botão "Recolher" do rodapé do painel também fecha a barra', () => {
    render(<VariablesPanel onInsert={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Variáveis/i }));
    expect(screen.getByText('{{name}}')).toBeInTheDocument();

    // Nome acessível exatamente "Recolher" = botão do rodapé (o do cabeçalho é
    // "Recolher variáveis").
    fireEvent.click(screen.getByRole('button', { name: 'Recolher' }));
    expect(screen.queryByText('{{name}}')).not.toBeInTheDocument();
  });

  it('renderiza uma variável por linha com rótulo + chave', () => {
    render(<VariablesPanel onInsert={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Variáveis/i }));

    // Todas as chaves e todos os rótulos aparecem.
    for (const { key, label } of VARIABLES) {
      expect(screen.getByText(key)).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // A descrição vira tooltip (title), não linha própria.
    const name = VARIABLES.find((v) => v.key === '{{name}}')!;
    expect(screen.getByTitle(name.description)).toBeInTheDocument();
  });

  it('clicar numa variável chama onInsert com a chave e mostra feedback "inserido"', async () => {
    const onInsert = vi.fn();
    render(<VariablesPanel onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: /Variáveis/i }));

    fireEvent.click(screen.getByText('{{name}}'));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith('{{name}}');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{{name}}');
    // Feedback substitui a chave por "✓ inserido".
    expect(screen.getByText(/inserido/)).toBeInTheDocument();
  });

  it('o feedback "inserido" some após ~1,5s', () => {
    vi.useFakeTimers();
    try {
      render(<VariablesPanel onInsert={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /Variáveis/i }));
      fireEvent.click(screen.getByText('{{name}}'));
      expect(screen.getByText(/inserido/)).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1500));

      expect(screen.queryByText(/inserido/)).not.toBeInTheDocument();
      expect(screen.getByText('{{name}}')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dragstart numa linha seta o token no dataTransfer (fonte de arraste, story 140)', () => {
    render(<VariablesPanel onInsert={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Variáveis/i }));

    // Mock de DataTransfer (jsdom não popula em eventos sintéticos de DnD).
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: vi.fn((type: string, value: string) => { store[type] = value; }),
      getData: (type: string) => store[type] ?? '',
      effectAllowed: 'none',
    };

    const row = screen.getByText('{{name}}').closest('button')!;
    expect(row).toHaveAttribute('draggable', 'true');

    fireEvent.dragStart(row, { dataTransfer });

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '{{name}}');
    expect(dataTransfer.effectAllowed).toBe('copy');
  });

  it('não quebra quando a cópia para o clipboard falha', async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('clipboard bloqueado'),
    );
    render(<VariablesPanel onInsert={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Variáveis/i }));

    fireEvent.click(screen.getByText('{{cpf}}'));
    // Feedback aparece mesmo com a cópia rejeitada.
    await waitFor(() => expect(screen.getByText(/inserido/)).toBeInTheDocument());
  });

  // ─── open controlado (story 144) ────────────────────────────────────────────
  // Quando o editor passa `open`/`onOpenChange`, o painel obedece à prop (é o
  // que faz digitar `{{` abrir o drawer). O auto-collapse segue igual, agora
  // subindo o novo estado pelo callback.

  it('abre quando a prop `open` muda para true (modo controlado)', () => {
    const { rerender } = render(<VariablesPanel onInsert={vi.fn()} open={false} onOpenChange={vi.fn()} />);
    // Fechado: só a aba, sem a lista.
    expect(screen.queryByText('{{name}}')).not.toBeInTheDocument();

    // O editor "abre" o drawer via prop → a lista aparece sem clique do usuário.
    rerender(<VariablesPanel onInsert={vi.fn()} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('{{name}}')).toBeInTheDocument();
  });

  it('modo controlado: recolher sobe o novo estado por onOpenChange sem alternar sozinho', () => {
    const onOpenChange = vi.fn();
    render(<VariablesPanel onInsert={vi.fn()} open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Recolher variáveis/i }));
    // Estado é do dono (editor): o painel só avisa; não fecha por conta própria.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('{{name}}')).toBeInTheDocument();
  });
});
