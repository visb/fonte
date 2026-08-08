// Story 163 — imagem enviada como assinatura (upload no perfil).
//
// O backend (`POST /staff/me/signature`) só aceita PNG <= 5 MB (story 128), porque
// o PNG é o que garante fundo transparente na hora de imprimir sobre a linha de
// assinatura do documento. Quem fotografa a assinatura no papel manda JPG com fundo
// branco opaco — então a conversão para PNG, o redimensionamento e a remoção do
// fundo claro são responsabilidade do cliente, aqui.

/** Maior lado da imagem enviada (foto de celular chega com 3000+ px e 3-12 MB). */
export const MAX_SIGNATURE_DIMENSION = 1200;

/** Limiar de luminância padrão: acima disso o pixel é considerado fundo. */
export const DEFAULT_BACKGROUND_THRESHOLD = 230;
export const MIN_BACKGROUND_THRESHOLD = 180;
export const MAX_BACKGROUND_THRESHOLD = 250;

/** Faixa de transição abaixo do limiar: evita borda serrilhada no traço. */
export const BACKGROUND_FEATHER = 50;

/** Tamanho máximo do arquivo de entrada (a saída convertida cabe nos 5 MB da API). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

/** Mensagem de erro em pt-BR para a UI, ou `null` quando o arquivo é aceito. */
export function validateSignatureFile(file: File): string | null {
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Envie uma imagem PNG ou JPG.';
  }
  if (file.size > MAX_INPUT_BYTES) {
    return 'A imagem deve ter no máximo 10 MB.';
  }
  return null;
}

/** Reduz mantendo a proporção; imagem menor que o limite passa intacta (sem upscale). */
export function scaledDimensions(
  width: number,
  height: number,
  max: number = MAX_SIGNATURE_DIMENSION,
): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (largest <= max || largest <= 0) return { width, height };
  const ratio = max / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Torna transparente o fundo claro, in place, sobre o buffer RGBA do `ImageData`.
 * Luminância >= limiar zera o alpha; abaixo da faixa de transição o alpha fica
 * intacto; no meio o alpha é proporcional (feather, não corte binário).
 */
export function removeBackground(data: Uint8ClampedArray, threshold: number): void {
  const floor = threshold - BACKGROUND_FEATHER;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (luminance >= threshold) {
      data[i + 3] = 0;
    } else if (luminance > floor) {
      data[i + 3] = Math.round((alpha * (threshold - luminance)) / BACKGROUND_FEATHER);
    }
  }
}

interface DrawOptions {
  removeBackground: boolean;
  threshold: number;
}

/** Fonte de pixels aceita pelo canvas: `ImageBitmap` ou `<img>` já carregado. */
export type SignatureImageSource = CanvasImageSource & {
  width: number;
  height: number;
  close?: () => void;
};

function decodeWithImageElement(file: File): Promise<SignatureImageSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    image.src = url;
  });
}

/**
 * Decodifica o arquivo escolhido. `createImageBitmap` é o caminho rápido, mas o
 * decoder do `<img>` aceita PNGs que ele recusa (`InvalidStateError`) — daí o
 * fallback, que é o que garante que nenhuma imagem legítima seja rejeitada.
 */
export async function decodeImageFile(file: File): Promise<SignatureImageSource> {
  try {
    return await createImageBitmap(file);
  } catch {
    return await decodeWithImageElement(file);
  }
}

/** Desenha a imagem já redimensionada no canvas e aplica a remoção de fundo. */
export function drawSignature(
  canvas: HTMLCanvasElement,
  bitmap: SignatureImageSource,
  options: DrawOptions,
): void {
  const { width, height } = scaledDimensions(bitmap.width, bitmap.height);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível.');
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  if (!options.removeBackground) return;
  const imageData = context.getImageData(0, 0, width, height);
  removeBackground(imageData.data, options.threshold);
  context.putImageData(imageData, 0, 0);
}

/** Converte o canvas em PNG (formato exigido pela API). */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível gerar a imagem da assinatura.'));
    }, 'image/png');
  });
}
