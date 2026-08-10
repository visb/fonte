import { renderHook } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { useFieldSubmit } from './fieldSubmit';

/** Mutation de mentira: guarda as opções que a tela passou. */
function fakeMutation() {
  const mutate = jest.fn();
  return { mutation: { mutate }, mutate };
}

function submitWith(isOnline: boolean) {
  onlineManager.setOnline(isOnline);
  const { mutation, mutate } = fakeMutation();
  const { result } = renderHook(() => useFieldSubmit(mutation));
  return { submit: result.current, mutate };
}

afterEach(() => onlineManager.setOnline(true));

describe('useFieldSubmit', () => {
  it('com rede: confirma só quando o servidor responde', () => {
    const { submit, mutate } = submitWith(true);
    const onSent = jest.fn();
    const onQueued = jest.fn();

    submit({ any: 'input' }, { onSent, onQueued });

    // Nada acontece antes da resposta — o operador vê o botão trabalhando.
    expect(onSent).not.toHaveBeenCalled();
    expect(onQueued).not.toHaveBeenCalled();

    mutate.mock.calls[0][1].onSuccess({ id: 'criado' });

    expect(onSent).toHaveBeenCalledWith({ id: 'criado' });
    expect(onQueued).not.toHaveBeenCalled();
  });

  it('com rede: rejeição do servidor chega na tela', () => {
    const { submit, mutate } = submitWith(true);
    const onFailed = jest.fn();

    submit({}, { onFailed });
    mutate.mock.calls[0][1].onError({ response: { status: 422 } });

    expect(onFailed).toHaveBeenCalledWith({ response: { status: 422 } });
  });

  it('sem rede: a tela segue em frente na hora, sem esperar o envio', () => {
    const { submit, mutate } = submitWith(false);
    const onSent = jest.fn();
    const onQueued = jest.fn();

    submit({}, { onSent, onQueued });

    expect(mutate).toHaveBeenCalled();
    expect(onQueued).toHaveBeenCalledTimes(1);
    expect(onSent).not.toHaveBeenCalled();
  });

  it('sem rede: o item que sobe depois não dispara alerta fora de contexto', () => {
    const { submit, mutate } = submitWith(false);
    const onSent = jest.fn();
    const onFailed = jest.fn();

    submit({}, { onSent, onFailed, onQueued: jest.fn() });
    // Horas depois, quando a fila subir (ou falhar), a tela nem existe mais.
    mutate.mock.calls[0][1].onSuccess({ id: 'criado' });
    mutate.mock.calls[0][1].onError(new Error('tarde demais'));

    expect(onSent).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('sem handlers não quebra', () => {
    const { submit, mutate } = submitWith(true);

    expect(() => submit({})).not.toThrow();
    expect(() => mutate.mock.calls[0][1].onSuccess({})).not.toThrow();
    expect(() => mutate.mock.calls[0][1].onError(new Error('x'))).not.toThrow();
  });
});
