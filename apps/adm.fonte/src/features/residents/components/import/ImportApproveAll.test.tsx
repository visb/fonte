import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportApproveAll } from './ImportApproveAll';
import { IMPORT_TEXTS } from '../../constants';

afterEach(() => cleanup());

const noop = { onStart: vi.fn(), onStop: vi.fn() };

describe('ImportApproveAll', () => {
  it('desabilita o botão sem fichas pendentes', () => {
    render(<ImportApproveAll pendingCount={0} progress={null} isRunning={false} {...noop} />);
    expect(screen.getByRole('button', { name: new RegExp(IMPORT_TEXTS.approveAll) })).toBeDisabled();
  });

  it('abre o confirm e só dispara onStart após confirmar', async () => {
    const onStart = vi.fn();
    render(
      <ImportApproveAll
        pendingCount={3}
        progress={null}
        isRunning={false}
        onStart={onStart}
        onStop={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: new RegExp(IMPORT_TEXTS.approveAll) }));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(IMPORT_TEXTS.approveAllConfirmTitle)).toBeInTheDocument();
    expect(screen.getByText(/3 fichas prontas/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: IMPORT_TEXTS.approveAllConfirm }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('cancelar o confirm não dispara onStart', async () => {
    const onStart = vi.fn();
    render(
      <ImportApproveAll
        pendingCount={2}
        progress={null}
        isRunning={false}
        onStart={onStart}
        onStop={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: new RegExp(IMPORT_TEXTS.approveAll) }));
    await userEvent.click(screen.getByRole('button', { name: IMPORT_TEXTS.approveAllCancel }));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('rodando: mostra o progresso e o botão Parar chama onStop', async () => {
    const onStop = vi.fn();
    render(
      <ImportApproveAll
        pendingCount={5}
        progress={{ total: 10, done: 4, approved: 3, skipped: 1, failed: 0 }}
        isRunning
        onStart={vi.fn()}
        onStop={onStop}
      />,
    );
    expect(screen.getByText('Aprovando 4/10...')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: IMPORT_TEXTS.approveAllStop }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('concluído: mostra o resumo de aprovadas/puladas/erros', () => {
    render(
      <ImportApproveAll
        pendingCount={2}
        progress={{ total: 10, done: 10, approved: 7, skipped: 2, failed: 1 }}
        isRunning={false}
        {...noop}
      />,
    );
    expect(screen.getByTestId('approve-all-summary')).toHaveTextContent(
      '7 aprovadas, 2 puladas, 1 com erro.',
    );
  });
});
