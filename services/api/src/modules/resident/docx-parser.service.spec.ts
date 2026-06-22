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

import { DocxParserService } from './docx-parser.service';

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

  it('returns no images when the zip is corrupt', async () => {
    loadAsync.mockRejectedValue(new Error('bad zip'));
    modelReturns({ resident: {}, relatives: [], warnings: {}, houseName: 'C', photoImageIndex: 0 });
    const service = makeService();
    const out = await service.parseDocx(Buffer.from('x'));
    // no images extracted => index 0 is out of range => no photo
    expect(out.photoBase64).toBeNull();
  });
});
