import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignatureUploadPad } from './SignatureUploadPad';

// jsdom não implementa canvas 2D nem createImageBitmap. O contrato testado aqui é o
// do componente (o que ele emite e o que mostra); a prova de pixel da remoção de
// fundo está no teste puro de `lib/signatureImage.ts`.
const context = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) })),
  putImageData: vi.fn(),
};

function imageFile(type = 'image/jpeg', size = 2048, name = 'assinatura.jpg'): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function selectFile(file: File) {
  fireEvent.change(screen.getByLabelText('Imagem da assinatura'), { target: { files: [file] } });
}

const pngBlobs = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.map((call) => call[0]).filter((value): value is Blob => value instanceof Blob);

/** Fallback do decoder (`<img>`): no jsdom nunca carrega, então sempre falha aqui. */
class FailingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 2400, height: 1200, close: vi.fn() })),
  );
  vi.stubGlobal('Image', FailingImage);
  URL.createObjectURL = vi.fn(() => 'blob:assinatura');
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => context,
  ) as unknown as HTMLCanvasElement['getContext'];
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback, type?: string) {
    callback(new Blob(['png'], { type: type ?? 'image/png' }));
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SignatureUploadPad', () => {
  it('converte um JPG escolhido em um Blob PNG', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    selectFile(imageFile());

    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(1));
    expect(pngBlobs(onChange)[0].type).toBe('image/png');
    expect(screen.getByLabelText('Prévia da assinatura')).toBeInTheDocument();
    expect(screen.getByText('assinatura.jpg')).toBeInTheDocument();
  });

  it('rejeita tipo não aceito sem chamar onChange com imagem', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    selectFile(imageFile('image/webp', 2048, 'assinatura.webp'));

    expect(await screen.findByText('Envie uma imagem PNG ou JPG.')).toBeInTheDocument();
    expect(pngBlobs(onChange)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Selecionar imagem da assinatura' })).toBeInTheDocument();
  });

  it('rejeita arquivo acima de 10 MB', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    selectFile(imageFile('image/png', 11 * 1024 * 1024, 'grande.png'));

    expect(await screen.findByText('A imagem deve ter no máximo 10 MB.')).toBeInTheDocument();
    expect(pngBlobs(onChange)).toHaveLength(0);
  });

  it('nasce com "Remover fundo claro" ligado e o slider visível só com ele ligado', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    const checkbox = screen.getByLabelText('Remover fundo claro') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(screen.getByLabelText('Limiar de remoção do fundo')).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(screen.queryByLabelText('Limiar de remoção do fundo')).not.toBeInTheDocument();
  });

  it('desligar a remoção de fundo reprocessa a imagem e emite novo blob', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    selectFile(imageFile());
    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(1));
    expect(context.putImageData).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Remover fundo claro'));

    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(2));
    expect(context.putImageData).toHaveBeenCalledTimes(1);
  });

  it('mudar o limiar reprocessa a imagem', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    selectFile(imageFile());
    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('Limiar de remoção do fundo'), {
      target: { value: '200' },
    });
    expect(screen.getByText('200')).toBeInTheDocument();

    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(2));

    // "Restaurar padrão" só aparece fora do limiar default.
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }));
    expect(screen.getByText('230')).toBeInTheDocument();
  });

  it('o sinal de limpar descarta o arquivo e emite null', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    selectFile(imageFile());
    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(1));

    onChange.mockClear();
    rerender(<SignatureUploadPad onChange={onChange} clearSignal={1} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(screen.getByRole('button', { name: 'Selecionar imagem da assinatura' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Prévia da assinatura')).not.toBeInTheDocument();
  });

  it('soltar o arquivo na dropzone tem o mesmo efeito de escolher pelo input', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    const dropzone = screen.getByRole('button', { name: 'Selecionar imagem da assinatura' });
    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [imageFile()] } });

    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(1));
    expect(screen.getByLabelText('Prévia da assinatura')).toBeInTheDocument();
  });

  it('clicar na dropzone aciona o input de arquivo escondido', () => {
    render(<SignatureUploadPad onChange={vi.fn()} clearSignal={0} />);
    const input = screen.getByLabelText('Imagem da assinatura');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar imagem da assinatura' }));

    expect(click).toHaveBeenCalled();
  });

  it('"Trocar imagem" reabre o seletor com uma imagem já escolhida', async () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);
    const input = screen.getByLabelText('Imagem da assinatura');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});

    selectFile(imageFile());
    await waitFor(() => expect(pngBlobs(onChange)).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Trocar imagem' }));

    expect(click).toHaveBeenCalled();
  });

  it('ignora seleção vazia (usuário cancela o seletor)', () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    fireEvent.change(screen.getByLabelText('Imagem da assinatura'), { target: { files: [] } });

    expect(screen.getByRole('button', { name: 'Selecionar imagem da assinatura' })).toBeInTheDocument();
    expect(pngBlobs(onChange)).toHaveLength(0);
  });

  it('mostra erro quando o processamento da imagem falha', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('formato corrompido');
      }),
    );
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} />);

    selectFile(imageFile());

    expect(await screen.findByText('Não foi possível processar a imagem.')).toBeInTheDocument();
    expect(pngBlobs(onChange)).toHaveLength(0);
  });

  it('desabilitado não aceita clique nem drop', () => {
    const onChange = vi.fn();
    render(<SignatureUploadPad onChange={onChange} clearSignal={0} disabled />);

    const dropzone = screen.getByRole('button', { name: 'Selecionar imagem da assinatura' });
    const input = screen.getByLabelText('Imagem da assinatura');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});

    fireEvent.dragOver(dropzone);
    fireEvent.click(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [imageFile()] } });

    expect(click).not.toHaveBeenCalled();
    expect(pngBlobs(onChange)).toHaveLength(0);
  });
});
