import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ImportRelativesStep } from './ImportRelativesStep';
import type { DraftRelative } from '../../lib/types';

function rel(over: Partial<DraftRelative> = {}): DraftRelative {
  return { id: crypto.randomUUID(), name: 'Maria', phone: '11999998888', relationship: 'Mãe', include: true, ...over };
}

function renderStep(relatives: DraftRelative[] = [rel()]) {
  const onBack = vi.fn();
  const onNext = vi.fn();
  render(<ImportRelativesStep relatives={relatives} onBack={onBack} onNext={onNext} />);
  return { onBack, onNext };
}

afterEach(() => cleanup());

describe('ImportRelativesStep', () => {
  it('lista familiares detectados e conta os incluídos', () => {
    renderStep([rel({ name: 'Maria' }), rel({ name: 'João', include: false })]);
    expect(screen.getByText('Familiares detectados')).toBeInTheDocument();
    expect(screen.getByText(/Revise os familiares encontrados/)).toBeInTheDocument();
    expect(screen.getByText('1 familiar(es) será(ão) cadastrado(s).')).toBeInTheDocument();
  });

  it('mostra mensagem de lista vazia quando não há familiares', () => {
    renderStep([]);
    expect(screen.getByText(/Nenhum familiar foi detectado/)).toBeInTheDocument();
    expect(screen.getByText('Nenhum familiar será cadastrado.')).toBeInTheDocument();
  });

  it('toggle de inclusão alterna entre Incluir e Ignorar', () => {
    renderStep([rel()]);
    const toggle = screen.getByRole('button', { name: 'Desmarcar familiar' });
    expect(toggle).toHaveTextContent('Incluir');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Incluir familiar' })).toHaveTextContent('Ignorar');
    expect(screen.getByText('Nenhum familiar será cadastrado.')).toBeInTheDocument();
  });

  it('adicionar familiar cria uma linha em branco', () => {
    renderStep([]);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar familiar/ }));
    expect(screen.getByPlaceholderText('Nome do familiar')).toBeInTheDocument();
  });

  it('remover familiar tira a linha da lista', () => {
    renderStep([rel({ name: 'Maria' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Remover familiar' }));
    expect(screen.queryByDisplayValue('Maria')).not.toBeInTheDocument();
  });

  it('editar nome atualiza o estado e o submit devolve a lista', () => {
    const { onNext } = renderStep([rel({ name: 'Maria' })]);
    fireEvent.change(screen.getByPlaceholderText('Nome do familiar'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: /Próximo: Resumo/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext.mock.calls[0][0][0].name).toBe('Ana');
  });

  it('selecionar "Outro" parentesco revela o input livre', () => {
    renderStep([rel({ relationship: 'Mãe' })]);
    const card = screen.getByText('Parentesco').closest('div')!;
    const select = within(card).getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Outro' } });
    expect(screen.getByPlaceholderText('Especifique o parentesco')).toBeInTheDocument();
  });

  it('parentesco não-canônico abre em modo "Outro" já preenchido', () => {
    renderStep([rel({ relationship: 'Padrasto' })]);
    expect(screen.getByDisplayValue('Padrasto')).toBeInTheDocument();
  });

  it('voltar dispara onBack', () => {
    const { onBack } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
