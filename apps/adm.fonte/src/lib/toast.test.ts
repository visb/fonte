import { beforeEach, describe, expect, it, vi } from 'vitest';

const success = vi.fn();
const error = vi.fn();
const base = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => base(...args), {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => error(...args),
  }),
}));

import { toastAction, toastError, toastSuccess } from './toast';

beforeEach(() => vi.clearAllMocks());

describe('toastSuccess', () => {
  it('chama toast.success com a mensagem', () => {
    toastSuccess('Turma criada.');
    expect(success).toHaveBeenCalledWith('Turma criada.');
  });
});

describe('toastError', () => {
  it('usa a mensagem da API quando o erro tem response.data.message', () => {
    toastError({ response: { data: { message: 'Nome já cadastrado' } } }, 'Erro ao salvar turma.');
    expect(error).toHaveBeenCalledWith('Nome já cadastrado');
  });

  it('junta o array de mensagens do class-validator', () => {
    toastError(
      { response: { data: { message: ['Nome é obrigatório', 'Casa é obrigatória'] } } },
      'Erro ao salvar turma.',
    );
    expect(error).toHaveBeenCalledWith('Nome é obrigatório, Casa é obrigatória');
  });

  it('usa o fallback quando o erro não tem mensagem de API', () => {
    toastError(new Error('boom'), 'Erro ao salvar turma.');
    expect(error).toHaveBeenCalledWith('Erro ao salvar turma.');
  });
});

describe('toastAction', () => {
  it('repassa label e onClick para a ação do toast', () => {
    const onClick = vi.fn();
    toastAction('Marcado como feito.', { label: 'Desfazer', onClick });

    expect(base).toHaveBeenCalledWith('Marcado como feito.', {
      action: { label: 'Desfazer', onClick },
    });

    // A ação é executada pelo consumidor (story 127) — o wrapper só a repassa.
    const passed = base.mock.calls[0][1] as { action: { onClick: () => void } };
    passed.action.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
