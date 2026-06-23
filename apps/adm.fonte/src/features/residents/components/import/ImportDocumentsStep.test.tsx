import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ImportDocumentsStep } from './ImportDocumentsStep';

function file(name: string, size = 2048) {
  const f = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function renderStep(initialFiles: File[] = []) {
  const onBack = vi.fn();
  const onNext = vi.fn();
  const { container } = render(
    <ImportDocumentsStep initialFiles={initialFiles} onBack={onBack} onNext={onNext} />,
  );
  return { onBack, onNext, container };
}

afterEach(() => cleanup());

describe('ImportDocumentsStep', () => {
  it('mostra estado vazio sem arquivos', () => {
    renderStep([]);
    expect(screen.getByText('Nenhum arquivo adicionado.')).toBeInTheDocument();
  });

  it('lista arquivos iniciais com tamanho em KB', () => {
    renderStep([file('rg.pdf', 4096)]);
    expect(screen.getByText('rg.pdf')).toBeInTheDocument();
    expect(screen.getByText('4 KB')).toBeInTheDocument();
  });

  it('adicionar arquivo via input inclui na lista, ignorando duplicados por nome', () => {
    const { container } = renderStep([file('rg.pdf')]);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('cpf.pdf'), file('rg.pdf')] } });
    expect(screen.getByText('cpf.pdf')).toBeInTheDocument();
    // rg.pdf segue único (duplicado ignorado)
    expect(screen.getAllByText('rg.pdf')).toHaveLength(1);
  });

  it('remover arquivo tira da lista', () => {
    renderStep([file('rg.pdf')]);
    const removeBtn = screen.getByText('rg.pdf').closest('li')!.querySelector('button')!;
    fireEvent.click(removeBtn);
    expect(screen.queryByText('rg.pdf')).not.toBeInTheDocument();
  });

  it('continuar devolve os arquivos atuais', () => {
    const { onNext } = renderStep([file('rg.pdf')]);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext.mock.calls[0][0]).toHaveLength(1);
  });

  it('voltar dispara onBack', () => {
    const { onBack } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
