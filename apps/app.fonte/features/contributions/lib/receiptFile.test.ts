import { bytesToBase64, messageFromBinaryError, receiptFileUri } from './receiptFile';

function bytesOf(text: string): Uint8Array {
  const encoded = unescape(encodeURIComponent(text));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
  return out;
}

describe('bytesToBase64 (story 193)', () => {
  it('converte ASCII com o alfabeto canônico', () => {
    expect(bytesToBase64(bytesOf('Man'))).toBe('TWFu');
    expect(bytesToBase64(bytesOf('hello world'))).toBe('aGVsbG8gd29ybGQ=');
  });

  // Os dois restos (1 e 2 bytes) são exatamente onde uma implementação caseira
  // erra o padding — e um PDF com padding errado abre corrompido.
  it('faz o padding dos restos de 1 e 2 bytes', () => {
    expect(bytesToBase64(bytesOf('M'))).toBe('TQ==');
    expect(bytesToBase64(bytesOf('Ma'))).toBe('TWE=');
  });

  it('preserva bytes binários (o PDF não é texto)', () => {
    expect(bytesToBase64(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe('JVBERg==');
    expect(bytesToBase64(new Uint8Array([0x00, 0xff, 0x80]))).toBe('AP+A');
  });

  it('aceita ArrayBuffer além de Uint8Array', () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
    expect(bytesToBase64(buffer)).toBe('JVBERg==');
  });

  it('buffer vazio → string vazia', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });
});

describe('receiptFileUri (story 193)', () => {
  it('grava no cache, com o id da parcela no nome', () => {
    expect(receiptFileUri('file:///cache/', 'rcv-1')).toBe('file:///cache/recibo-rcv-1.pdf');
  });

  it('sem cacheDirectory (web/SSR), o nome sobrevive sem "null" no caminho', () => {
    expect(receiptFileUri(null, 'rcv-1')).toBe('recibo-rcv-1.pdf');
    expect(receiptFileUri(undefined, 'rcv-1')).toBe('recibo-rcv-1.pdf');
  });
});

describe('messageFromBinaryError (story 193)', () => {
  const acionavel =
    'Nenhum template de recibo cadastrado para contribuição mensal do acolhido. Cadastre em Configurações → Templates.';

  it('lê a frase acionável do backend do corpo binário (com acento)', () => {
    const error = { response: { data: bytesOf(JSON.stringify({ message: acionavel })).buffer } };
    expect(messageFromBinaryError(error)).toBe(acionavel);
  });

  it('aceita o corpo como Uint8Array (axios entrega os dois formatos)', () => {
    const error = { response: { data: bytesOf(JSON.stringify({ message: 'Parcela não encontrada' })) } };
    expect(messageFromBinaryError(error)).toBe('Parcela não encontrada');
  });

  it('junta mensagens de validação em lista', () => {
    const error = { response: { data: bytesOf(JSON.stringify({ message: ['a', 'b'] })).buffer } };
    expect(messageFromBinaryError(error)).toBe('a, b');
  });

  it('corpo não-binário, ilegível ou sem message → null (o chamador usa o fallback)', () => {
    expect(messageFromBinaryError(new Error('network'))).toBeNull();
    expect(messageFromBinaryError({ response: { data: { message: 'json normal' } } })).toBeNull();
    expect(messageFromBinaryError({ response: { data: bytesOf('%PDF-1.4').buffer } })).toBeNull();
    expect(messageFromBinaryError({ response: { data: bytesOf('{}').buffer } })).toBeNull();
    expect(messageFromBinaryError(undefined)).toBeNull();
  });

  it('decodifica sem TextDecoder (Hermes) pelo caminho de %-escapes', () => {
    const original = (globalThis as { TextDecoder?: unknown }).TextDecoder;
    // @ts-expect-error — simula o runtime sem TextDecoder.
    delete globalThis.TextDecoder;
    try {
      const error = { response: { data: bytesOf(JSON.stringify({ message: acionavel })).buffer } };
      expect(messageFromBinaryError(error)).toBe(acionavel);
    } finally {
      (globalThis as { TextDecoder?: unknown }).TextDecoder = original;
    }
  });
});
