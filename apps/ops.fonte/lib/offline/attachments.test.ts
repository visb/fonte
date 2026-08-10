import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import {
  buildFormDataFromOutboxFile,
  discardOutboxFile,
  outboxDirectory,
  persistOutboxFile,
} from './attachments';

jest.mock('expo-file-system', () => ({
  // Sem `__esModule` o interop copia o namespace no import e `documentDirectory`
  // congela no valor inicial — o teste do dispositivo sem FS não conseguiria rodar.
  __esModule: true,
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const fs = FileSystem as unknown as {
  documentDirectory: string | null;
  makeDirectoryAsync: jest.Mock;
  copyAsync: jest.Mock;
  deleteAsync: jest.Mock;
};

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  fs.documentDirectory = 'file:///doc/';
  // @ts-expect-error restaura a plataforma entre os testes
  Platform.OS = originalOS;
});

afterAll(() => {
  // @ts-expect-error restaura a plataforma
  Platform.OS = originalOS;
});

function forceWeb() {
  // @ts-expect-error força o ramo web
  Platform.OS = 'web';
}

describe('persistOutboxFile (nativo)', () => {
  it('copia o arquivo do picker para documentDirectory/outbox/', async () => {
    const path = await persistOutboxFile('file:///cache/ImagePicker/abc.jpg', 'foto.jpg');

    expect(path).toBe('file:///doc/outbox/foto.jpg');
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith('file:///doc/outbox/', {
      intermediates: true,
    });
    expect(fs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/ImagePicker/abc.jpg',
      to: 'file:///doc/outbox/foto.jpg',
    });
  });

  it('gera nome estável preservando a extensão quando não recebe um', async () => {
    const path = await persistOutboxFile('file:///cache/abc.png?x=1');

    expect(path).toMatch(/^file:\/\/\/doc\/outbox\/\d+-\d+\.png$/);
  });

  it('sem diretório de documentos devolve o próprio uri (não perde o anexo)', async () => {
    fs.documentDirectory = null;

    expect(outboxDirectory()).toBeNull();
    await expect(persistOutboxFile('file:///cache/abc.jpg')).resolves.toBe(
      'file:///cache/abc.jpg',
    );
    expect(fs.copyAsync).not.toHaveBeenCalled();
  });
});

describe('persistOutboxFile (web)', () => {
  it('persiste o conteúdo como data URL (o blob: do picker morre com a aba)', async () => {
    forceWeb();
    global.fetch = jest
      .fn()
      .mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })) }) as never;

    const path = await persistOutboxFile('blob:http://localhost/abc');

    expect(path.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(fs.copyAsync).not.toHaveBeenCalled();
  });
});

describe('buildFormDataFromOutboxFile', () => {
  it('nativo: anexa { uri, name, type } como o RN espera', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');

    await buildFormDataFromOutboxFile('file:///doc/outbox/foto.jpg', { type: 'image/png' });

    expect(append).toHaveBeenCalledWith('file', {
      uri: 'file:///doc/outbox/foto.jpg',
      name: 'photo.jpg',
      type: 'image/png',
    });
    append.mockRestore();
  });

  it('data URL: remonta o blob (mesmo em nativo, se o anexo tiver vindo do web)', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as never;

    await buildFormDataFromOutboxFile('data:image/jpeg;base64,eA==');

    expect(global.fetch).toHaveBeenCalledWith('data:image/jpeg;base64,eA==');
    expect(append).toHaveBeenCalledWith('file', blob, 'photo.jpg');
    append.mockRestore();
  });

  it('web: monta o multipart a partir do blob', async () => {
    forceWeb();
    const append = jest.spyOn(FormData.prototype, 'append');
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as never;

    await buildFormDataFromOutboxFile('blob:http://localhost/abc', { name: 'p.jpg' });

    expect(append).toHaveBeenCalledWith('file', blob, 'p.jpg');
    append.mockRestore();
  });
});

describe('discardOutboxFile', () => {
  it('apaga o arquivo quando o item sai da fila', async () => {
    await discardOutboxFile('file:///doc/outbox/foto.jpg');

    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/outbox/foto.jpg', {
      idempotent: true,
    });
  });

  it('ignora caminho vazio, data URL e web (não há o que apagar)', async () => {
    forceWeb();
    await discardOutboxFile('file:///doc/outbox/foto.jpg');
    // @ts-expect-error volta ao nativo
    Platform.OS = originalOS;
    await discardOutboxFile(null);
    await discardOutboxFile('data:image/jpeg;base64,eA==');

    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });

  it('falha ao apagar não derruba o fluxo (o lixo é o arquivo, não o lançamento)', async () => {
    fs.deleteAsync.mockRejectedValueOnce(new Error('EBUSY'));

    await expect(discardOutboxFile('file:///doc/outbox/foto.jpg')).resolves.toBeUndefined();
  });
});
