/**
 * Anexos da outbox (story 169, decisão 6).
 *
 * O URI que o `ImagePicker` devolve aponta para o cache do SO e pode ser
 * evicted antes de o item da fila ser enviado — offline isso pode levar horas.
 * Por isso o arquivo escolhido é **copiado** para um diretório próprio do app e
 * o que vai para a fila é o caminho copiado. O `FormData` (que não é
 * serializável) é remontado só na hora do envio.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const OUTBOX_DIRECTORY_NAME = 'outbox/';

/** Diretório dos anexos enfileirados. `null` em web (não há FS). */
export function outboxDirectory(): string | null {
  const documentDirectory = FileSystem.documentDirectory;
  return documentDirectory ? `${documentDirectory}${OUTBOX_DIRECTORY_NAME}` : null;
}

function isDataUrl(path: string): boolean {
  return path.startsWith('data:');
}

function extensionOf(uri: string, fallback = 'jpg'): string {
  const withoutQuery = uri.split('?')[0];
  const match = /\.([a-zA-Z0-9]{1,5})$/.exec(withoutQuery);
  return match ? match[1] : fallback;
}

async function toDataUrl(uri: string): Promise<string> {
  const blob = await fetch(uri).then((response) => response.blob());
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo.'));
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * Copia o arquivo para um caminho estável e devolve esse caminho.
 *
 * Em web não há sistema de arquivos: o conteúdo vira **data URL**, que é
 * autossuficiente (sobrevive ao reload junto da mutation persistida) e entra na
 * fila no lugar do `blob:` do picker, que morre com a aba.
 */
export async function persistOutboxFile(uri: string, name?: string): Promise<string> {
  if (Platform.OS === 'web') return toDataUrl(uri);

  const directory = outboxDirectory();
  if (!directory) return uri;

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const fileName = name ?? `${Date.now()}-${Math.floor(Math.random() * 1e6)}.${extensionOf(uri)}`;
  const destination = `${directory}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export interface OutboxFileDescriptor {
  name?: string;
  type?: string;
  /** Nome do campo do multipart (o backend usa `file` em todos os uploads do escopo). */
  field?: string;
}

/**
 * Remonta o `FormData` do arquivo enfileirado. Mesmo tratamento nativo/web que
 * o `buildPhotoFormData` do censo tinha inline — generalizado aqui porque agora
 * o upload acontece longe da tela que escolheu o arquivo.
 */
export async function buildFormDataFromOutboxFile(
  path: string,
  { name = 'photo.jpg', type = 'image/jpeg', field = 'file' }: OutboxFileDescriptor = {},
): Promise<FormData> {
  const formData = new FormData();

  if (Platform.OS === 'web' || isDataUrl(path)) {
    const blob = await fetch(path).then((response) => response.blob());
    formData.append(field, blob, name);
    return formData;
  }

  formData.append(field, { uri: path, name, type } as unknown as Blob);
  return formData;
}

/**
 * Apaga o arquivo quando o item sai da fila (sucesso ou descarte). Falha ao
 * apagar não pode derrubar o envio: o arquivo é lixo, não o lançamento.
 */
export async function discardOutboxFile(path: string | undefined | null): Promise<void> {
  if (!path || Platform.OS === 'web' || isDataUrl(path)) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // silencioso de propósito: ver comentário acima.
  }
}
