import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const parseDocx = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { residents: { parseDocx: (...a: unknown[]) => parseDocx(...a) } },
}));

import { ImportUploadStep } from './ImportUploadStep';

function docx(name = 'ficha.docx', size = 1024) {
  const f = new File(['x'], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function renderStep() {
  const onParsed = vi.fn();
  const { container } = render(<ImportUploadStep onParsed={onParsed} />);
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  return { onParsed, input };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => cleanup());

describe('ImportUploadStep', () => {
  it('renderiza a área de upload', () => {
    renderStep();
    expect(screen.getByText('Importar ficha de acolhimento')).toBeInTheDocument();
    expect(screen.getByText(/Arraste o arquivo aqui/)).toBeInTheDocument();
  });

  it('rejeita arquivo que não é .docx', () => {
    const { input, onParsed } = renderStep();
    const bad = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(bad, 'size', { value: 1024 });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(screen.getByText('Apenas arquivos .docx são aceitos.')).toBeInTheDocument();
    expect(parseDocx).not.toHaveBeenCalled();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it('rejeita arquivo acima de 5 MB', () => {
    const { input } = renderStep();
    fireEvent.change(input, { target: { files: [docx('grande.docx', 6 * 1024 * 1024)] } });
    expect(screen.getByText(/Arquivo muito grande/)).toBeInTheDocument();
    expect(parseDocx).not.toHaveBeenCalled();
  });

  it('parseia .docx válido e chama onParsed com o resultado normalizado', async () => {
    parseDocx.mockResolvedValue({
      resident: { name: 'Fulano' },
      relatives: [{ name: 'Mãe', phone: '11', relationship: 'mãe' }],
      warnings: [],
      houseName: 'Casa A',
      rawText: 'texto',
      photoBase64: null,
    });
    const { input, onParsed } = renderStep();
    fireEvent.change(input, { target: { files: [docx()] } });
    await waitFor(() => expect(onParsed).toHaveBeenCalled());
    const [result, fileArg] = onParsed.mock.calls[0];
    expect(result.houseName).toBe('Casa A');
    expect(result.relatives[0]).toMatchObject({ name: 'Mãe', include: true });
    expect(result.relatives[0].id).toBeTruthy();
    expect(fileArg.name).toBe('ficha.docx');
  });

  it('mostra erro quando o parse falha', async () => {
    parseDocx.mockRejectedValue(new Error('boom'));
    const { input, onParsed } = renderStep();
    fireEvent.change(input, { target: { files: [docx()] } });
    await waitFor(() =>
      expect(screen.getByText(/Não foi possível extrair os dados/)).toBeInTheDocument(),
    );
    expect(onParsed).not.toHaveBeenCalled();
  });

  it('drop de arquivo também aciona o parse', async () => {
    parseDocx.mockResolvedValue({ resident: {}, relatives: [], warnings: [], houseName: null, rawText: '', photoBase64: null });
    const { onParsed } = renderStep();
    const dropZone = screen.getByRole('button', { name: /Área de upload/ });
    fireEvent.drop(dropZone, { dataTransfer: { files: [docx()] } });
    await waitFor(() => expect(onParsed).toHaveBeenCalled());
  });
});
