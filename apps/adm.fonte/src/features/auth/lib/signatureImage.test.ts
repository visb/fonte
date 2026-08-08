import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCEPTED_MIME_TYPES,
  BACKGROUND_FEATHER,
  DEFAULT_BACKGROUND_THRESHOLD,
  MAX_INPUT_BYTES,
  canvasToPngBlob,
  decodeImageFile,
  drawSignature,
  removeBackground,
  scaledDimensions,
  validateSignatureFile,
} from './signatureImage';

function fileOf(type: string, size = 1024): File {
  const file = new File(['x'], 'assinatura', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** Buffer RGBA de um único pixel. */
function pixel(r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a]);
}

describe('validateSignatureFile', () => {
  it.each(ACCEPTED_MIME_TYPES)('aceita %s', (type) => {
    expect(validateSignatureFile(fileOf(type))).toBeNull();
  });

  it.each(['image/webp', 'image/gif', 'application/pdf'])('rejeita %s pelo tipo', (type) => {
    expect(validateSignatureFile(fileOf(type))).toBe('Envie uma imagem PNG ou JPG.');
  });

  it('rejeita arquivo acima de 10 MB pelo tamanho', () => {
    expect(validateSignatureFile(fileOf('image/jpeg', MAX_INPUT_BYTES + 1))).toBe(
      'A imagem deve ter no máximo 10 MB.',
    );
  });

  it('aceita arquivo exatamente no limite de 10 MB', () => {
    expect(validateSignatureFile(fileOf('image/png', MAX_INPUT_BYTES))).toBeNull();
  });
});

describe('scaledDimensions', () => {
  it('reduz paisagem mantendo a proporção', () => {
    expect(scaledDimensions(3000, 2000)).toEqual({ width: 1200, height: 800 });
  });

  it('reduz retrato mantendo a proporção', () => {
    expect(scaledDimensions(2000, 3000)).toEqual({ width: 800, height: 1200 });
  });

  it('não amplia imagem menor que o limite', () => {
    expect(scaledDimensions(400, 120)).toEqual({ width: 400, height: 120 });
  });

  it('mantém imagem quadrada exatamente no limite', () => {
    expect(scaledDimensions(1200, 1200)).toEqual({ width: 1200, height: 1200 });
  });

  it('arredonda sem produzir dimensão zero', () => {
    const result = scaledDimensions(6000, 3);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(1);
  });

  it('devolve as dimensões originais quando não há imagem (0x0)', () => {
    expect(scaledDimensions(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it('aceita limite customizado', () => {
    expect(scaledDimensions(1000, 500, 100)).toEqual({ width: 100, height: 50 });
  });
});

describe('removeBackground', () => {
  it('zera o alpha do pixel branco', () => {
    const data = pixel(255, 255, 255);
    removeBackground(data, DEFAULT_BACKGROUND_THRESHOLD);
    expect(data[3]).toBe(0);
  });

  it('mantém o alpha do pixel preto', () => {
    const data = pixel(0, 0, 0);
    removeBackground(data, DEFAULT_BACKGROUND_THRESHOLD);
    expect(data[3]).toBe(255);
  });

  it('aplica alpha intermediário na faixa de transição (feather)', () => {
    // luminância 200: entre 180 (230 - 50) e 230.
    const data = pixel(200, 200, 200);
    removeBackground(data, DEFAULT_BACKGROUND_THRESHOLD);
    expect(data[3]).toBeGreaterThan(0);
    expect(data[3]).toBeLessThan(255);
    expect(data[3]).toBe(Math.round((255 * 30) / BACKGROUND_FEATHER));
  });

  it('limiar mais alto preserva cinza que o limiar baixo apagaria', () => {
    const gray = () => pixel(190, 190, 190);
    const low = gray();
    const high = gray();
    removeBackground(low, 185);
    removeBackground(high, 250);
    expect(low[3]).toBe(0);
    expect(high[3]).toBe(255);
  });

  it('mantém em 0 o pixel já transparente', () => {
    const data = pixel(10, 10, 10, 0);
    removeBackground(data, DEFAULT_BACKGROUND_THRESHOLD);
    expect(data[3]).toBe(0);
  });

  it('altera o buffer in place, sem realocar, e não mexe no RGB', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const before = data.buffer;
    removeBackground(data, DEFAULT_BACKGROUND_THRESHOLD);
    expect(data.buffer).toBe(before);
    expect(Array.from(data)).toEqual([255, 255, 255, 0, 0, 0, 0, 255]);
  });
});

describe('drawSignature', () => {
  function fakeCanvas(context: unknown | null) {
    return {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
  }

  function fakeContext(data: Uint8ClampedArray) {
    return {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data })),
      putImageData: vi.fn(),
    };
  }

  const bitmap = { width: 2400, height: 1200 } as unknown as CanvasImageSource & {
    width: number;
    height: number;
  };

  it('redimensiona o canvas e aplica a remoção de fundo', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    const context = fakeContext(data);
    const canvas = fakeCanvas(context);

    drawSignature(canvas, bitmap, { removeBackground: true, threshold: 230 });

    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(600);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1200, 600);
    expect(context.putImageData).toHaveBeenCalled();
    expect(data[3]).toBe(0);
  });

  it('não lê os pixels quando a remoção de fundo está desligada', () => {
    const context = fakeContext(new Uint8ClampedArray([255, 255, 255, 255]));
    drawSignature(fakeCanvas(context), bitmap, { removeBackground: false, threshold: 230 });
    expect(context.getImageData).not.toHaveBeenCalled();
  });

  it('falha quando o contexto 2D não existe', () => {
    expect(() =>
      drawSignature(fakeCanvas(null), bitmap, { removeBackground: true, threshold: 230 }),
    ).toThrow('Canvas 2D indisponível.');
  });
});

describe('decodeImageFile', () => {
  const png = () => new File(['x'], 'assinatura.png', { type: 'image/png' });

  // jsdom não decodifica imagem: o que se testa aqui é a escolha do decoder.
  function stubImageElement(fails: boolean) {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 300;
      height = 150;
      set src(_value: string) {
        queueMicrotask(() => (fails ? this.onerror?.() : this.onload?.()));
      }
    }
    vi.stubGlobal('Image', FakeImage);
    URL.createObjectURL = vi.fn(() => 'blob:assinatura');
    URL.revokeObjectURL = vi.fn();
  }

  afterEach(() => vi.unstubAllGlobals());

  it('usa createImageBitmap quando ele decodifica o arquivo', async () => {
    const bitmap = { width: 800, height: 400 };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));

    await expect(decodeImageFile(png())).resolves.toBe(bitmap);
  });

  it('cai para o <img> quando createImageBitmap recusa o arquivo', async () => {
    // Chromium lança InvalidStateError em PNGs que o <img> aceita sem reclamar.
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
      }),
    );
    stubImageElement(false);

    const image = await decodeImageFile(png());

    expect(image.width).toBe(300);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:assinatura');
  });

  it('rejeita quando nem o <img> consegue ler o arquivo', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('sem suporte');
      }),
    );
    stubImageElement(true);

    await expect(decodeImageFile(png())).rejects.toThrow('Não foi possível ler a imagem.');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('canvasToPngBlob', () => {
  it('resolve com o blob PNG do canvas', async () => {
    const canvas = {
      toBlob: (cb: (b: Blob | null) => void, type: string) => cb(new Blob(['png'], { type })),
    } as unknown as HTMLCanvasElement;
    const blob = await canvasToPngBlob(canvas);
    expect(blob.type).toBe('image/png');
  });

  it('rejeita quando o canvas não produz blob', async () => {
    const canvas = {
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    } as unknown as HTMLCanvasElement;
    await expect(canvasToPngBlob(canvas)).rejects.toThrow(
      'Não foi possível gerar a imagem da assinatura.',
    );
  });
});
