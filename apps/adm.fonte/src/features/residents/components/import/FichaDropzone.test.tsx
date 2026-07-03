import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { FichaDropzone } from './FichaDropzone';

function docx(name: string): File {
  return new File(['x'], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

afterEach(() => cleanup());

describe('FichaDropzone', () => {
  it('desabilitada sem planilha: mostra aviso e não abre seletor', () => {
    const onFiles = vi.fn();
    const { container } = render(<FichaDropzone disabled onFiles={onFiles} />);
    expect(
      screen.getByText('Carregue a planilha de referência antes de adicionar as fichas.'),
    ).toBeInTheDocument();
    expect(getInput(container)).toBeDisabled();
    // drop enquanto desabilitada é ignorado
    fireEvent.drop(screen.getByRole('button', { name: 'Área de upload das fichas DOCX' }), {
      dataTransfer: { files: [docx('a.docx')] },
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('aceita múltiplos .docx e chama onFiles com os aceitos', () => {
    const onFiles = vi.fn();
    const { container } = render(<FichaDropzone disabled={false} onFiles={onFiles} />);
    fireEvent.change(getInput(container), {
      target: { files: [docx('a.docx'), docx('b.docx')] },
    });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toHaveLength(2);
  });

  it('rejeita não-.docx: avisa e envia só os válidos', () => {
    const onFiles = vi.fn();
    const { container } = render(<FichaDropzone disabled={false} onFiles={onFiles} />);
    fireEvent.change(getInput(container), {
      target: { files: [docx('a.docx'), new File(['x'], 'foto.png')] },
    });
    expect(screen.getByText('Apenas arquivos .docx são aceitos.')).toBeInTheDocument();
    expect(onFiles.mock.calls[0][0]).toHaveLength(1);
  });

  it('todos inválidos: avisa e não chama onFiles', () => {
    const onFiles = vi.fn();
    const { container } = render(<FichaDropzone disabled={false} onFiles={onFiles} />);
    fireEvent.change(getInput(container), { target: { files: [new File(['x'], 'foto.png')] } });
    expect(screen.getByText('Apenas arquivos .docx são aceitos.')).toBeInTheDocument();
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('drop de .docx habilitado chama onFiles; click e drag over/leave não quebram', () => {
    const onFiles = vi.fn();
    render(<FichaDropzone disabled={false} onFiles={onFiles} />);
    const zone = screen.getByRole('button', { name: 'Área de upload das fichas DOCX' });
    fireEvent.click(zone); // abre o seletor
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [docx('a.docx')] } });
    expect(onFiles).toHaveBeenCalled();
  });

  it('drop sem arquivos (dataTransfer nulo) é ignorado sem erro', () => {
    const onFiles = vi.fn();
    render(<FichaDropzone disabled={false} onFiles={onFiles} />);
    const zone = screen.getByRole('button', { name: 'Área de upload das fichas DOCX' });
    fireEvent.drop(zone, { dataTransfer: { files: null } });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
