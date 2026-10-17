import { BadRequestException } from '@nestjs/common';

const messagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: messagesCreate } })),
}));

const extractRawText = jest.fn();
jest.mock('mammoth', () => ({ extractRawText: (...a: unknown[]) => extractRawText(...a) }));

const loadAsync = jest.fn();
jest.mock('jszip', () => ({ loadAsync: (...a: unknown[]) => loadAsync(...a) }));

import { MaritalStatus } from '@fonte/types';
import { DocxParserService, normalizeMaritalStatus } from './docx-parser.service';

function makeService(apiKey: string | null = 'key') {
  const config = { get: jest.fn().mockReturnValue(apiKey ?? undefined) };
  return new DocxParserService(config as never);
}

function modelReturns(obj: unknown, stopReason = 'end_turn') {
  messagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(obj) }],
    stop_reason: stopReason,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  extractRawText.mockResolvedValue({ value: 'texto da ficha' });
  loadAsync.mockResolvedValue({ files: {} });
});

describe('DocxParserService.parseDocx', () => {
  it('throws BadRequest when the API key is missing', async () => {
    const service = makeService(null);
    await expect(service.parseDocx(Buffer.from('x'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parses the model JSON and echoes the raw text', async () => {
    modelReturns({
      resident: { name: 'Ana' },
      relatives: [{ name: 'Maria', phone: '9', relationship: 'mãe' }],
      warnings: {},
      houseName: 'Casa 1',
      photoImageIndex: null,
    });
    const service = makeService();
    const out = await service.parseDocx(Buffer.from('x'));
    expect(out.resident.name).toBe('Ana');
    expect(out.relatives).toHaveLength(1);
    expect(out.rawText).toBe('texto da ficha');
    expect(out.photoBase64).toBeNull();
  });

  it('tolerates fenced JSON in the model response', async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"resident":{"name":"Joao"},"relatives":[],"warnings":{},"houseName":"C"}\n```' }],
      stop_reason: 'end_turn',
    });
    const service = makeService();
    const out = await service.parseDocx(Buffer.from('x'));
    expect(out.resident.name).toBe('Joao');
  });

  it('throws BadRequest when the model returns invalid JSON', async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
      stop_reason: 'max_tokens',
    });
    const service = makeService();
    await expect(service.parseDocx(Buffer.from('x'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('attaches the resident photo when the model points to a valid image index', async () => {
    const PNG_1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
      'base64',
    );
    loadAsync.mockResolvedValue({
      files: {
        'word/media/image1.png': { dir: false, name: 'word/media/image1.png', async: jest.fn().mockResolvedValue(PNG_1x1) },
      },
    });
    modelReturns({ resident: {}, relatives: [], warnings: {}, houseName: 'C', photoImageIndex: 0 });
    const service = makeService();
    const out = await service.parseDocx(Buffer.from('x'));
    expect(out.photoBase64).toMatch(/^data:image\/png;base64,/);
  });

  it('ignores an out-of-range photo index', async () => {
    modelReturns({ resident: {}, relatives: [], warnings: {}, houseName: 'C', photoImageIndex: 9 });
    const service = makeService();
    const out = await service.parseDocx(Buffer.from('x'));
    expect(out.photoBase64).toBeNull();
  });

  it('sanitizes technical jargon in warnings', async () => {
    modelReturns({
      resident: {},
      relatives: [],
      warnings: { weight: 'O peso ficou null na ficha' },
      houseName: 'C',
      photoImageIndex: null,
    });
    const service = makeService();
    const out = await service.parseDocx(Buffer.from('x'));
    expect(out.warnings.weight).toContain('vazio');
    expect(out.warnings.weight).not.toContain('null');
  });

  it('normalizes the marital status returned by the model (story 210)', async () => {
    modelReturns({ resident: { maritalStatus: 'União estável' }, relatives: [], warnings: {}, houseName: 'C' });
    const out = await makeService().parseDocx(Buffer.from('x'));
    expect(out.resident.maritalStatus).toBe(MaritalStatus.STABLE_UNION);
  });

  it('keeps resident without maritalStatus key untouched', async () => {
    modelReturns({ resident: { name: 'Ana' }, relatives: [], warnings: {}, houseName: 'C' });
    const out = await makeService().parseDocx(Buffer.from('x'));
    expect('maritalStatus' in out.resident).toBe(false);
  });

  it('returns no images when the zip is corrupt', async () => {
    loadAsync.mockRejectedValue(new Error('bad zip'));
    modelReturns({ resident: {}, relatives: [], warnings: {}, houseName: 'C', photoImageIndex: 0 });
    const service = makeService();
    const out = await service.parseDocx(Buffer.from('x'));
    // no images extracted => index 0 is out of range => no photo
    expect(out.photoBase64).toBeNull();
  });
});

describe('normalizeMaritalStatus (story 210)', () => {
  it.each([
    ['União estável', MaritalStatus.STABLE_UNION],
    ['UNIAO ESTAVEL', MaritalStatus.STABLE_UNION],
    ['Amasiado', MaritalStatus.STABLE_UNION],
    ['amasiada', MaritalStatus.STABLE_UNION],
    ['Convivente', MaritalStatus.STABLE_UNION],
    ['Companheira', MaritalStatus.STABLE_UNION],
    ['Viúvo', MaritalStatus.WIDOWED],
    ['viuva', MaritalStatus.WIDOWED],
    ['Solteiro', MaritalStatus.SINGLE],
    ['Casado', MaritalStatus.MARRIED],
    ['Divorciado', MaritalStatus.DIVORCED],
    ['Separado', MaritalStatus.DIVORCED],
    ['STABLE_UNION', MaritalStatus.STABLE_UNION],
    ['widowed', MaritalStatus.WIDOWED],
    ['SINGLE', MaritalStatus.SINGLE],
  ])('maps %p to %p', (input, expected) => {
    expect(normalizeMaritalStatus(input)).toBe(expected);
  });

  it.each([[null], [undefined], [''], ['   '], ['Desconhecido'], [42]])('returns null for %p', (input) => {
    expect(normalizeMaritalStatus(input)).toBeNull();
  });
});
