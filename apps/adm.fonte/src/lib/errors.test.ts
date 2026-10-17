import { describe, expect, it } from 'vitest';
import { ReceiptType } from '@fonte/types';
import {
  getErrorCode,
  getErrorMessage,
  getMissingReceiptTemplateType,
  isNotFoundError,
  parseBlobError,
} from './errors';

describe('getErrorMessage', () => {
  it('extrai a mensagem string do shape de erro da API', () => {
    const error = { response: { data: { message: 'Nome já cadastrado' } } };
    expect(getErrorMessage(error)).toBe('Nome já cadastrado');
  });

  it('junta um array de mensagens (class-validator) com vírgula', () => {
    const error = {
      response: { data: { message: ['Nome é obrigatório', 'Email inválido'] } },
    };
    expect(getErrorMessage(error)).toBe('Nome é obrigatório, Email inválido');
  });

  it('usa o fallback padrão quando não há mensagem', () => {
    expect(getErrorMessage({})).toBe('Ocorreu um erro inesperado.');
    expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
    expect(getErrorMessage(undefined)).toBe('Ocorreu um erro inesperado.');
  });

  it('usa o fallback customizado quando informado', () => {
    expect(getErrorMessage(new Error('boom'), 'Erro ao salvar')).toBe('Erro ao salvar');
    expect(getErrorMessage({ response: {} }, 'Erro ao salvar')).toBe('Erro ao salvar');
  });
});

// ─── Story 212 — code/receiptType, inclusive de corpo Blob ───────────────────

const MISSING_BODY = {
  statusCode: 404,
  message: 'Nenhum template de recibo cadastrado para contribuição mensal do acolhido.',
  code: 'RECEIPT_TEMPLATE_MISSING',
  receiptType: 'RESIDENT_CONTRIBUTION',
};

describe('getErrorCode / getMissingReceiptTemplateType', () => {
  it('extrai code e o tipo do recibo de erro JSON', () => {
    const error = { response: { status: 404, data: MISSING_BODY } };
    expect(getErrorCode(error)).toBe('RECEIPT_TEMPLATE_MISSING');
    expect(getMissingReceiptTemplateType(error)).toBe(ReceiptType.RESIDENT_CONTRIBUTION);
  });

  it('404 sem o code (parcela inexistente) não é template ausente', () => {
    const error = { response: { status: 404, data: { message: 'Parcela não encontrada' } } };
    expect(getErrorCode(error)).toBeUndefined();
    expect(getMissingReceiptTemplateType(error)).toBeNull();
  });

  it('receiptType fora do enum é ignorado', () => {
    const error = { response: { data: { ...MISSING_BODY, receiptType: 'XPTO' } } };
    expect(getMissingReceiptTemplateType(error)).toBeNull();
  });

  it('corpo ainda em Blob não é lido pelos helpers síncronos', () => {
    const error = { response: { data: new Blob([JSON.stringify(MISSING_BODY)]) } };
    expect(getErrorMessage(error, 'fallback')).toBe('fallback');
    expect(getErrorCode(error)).toBeUndefined();
  });
});

describe('parseBlobError', () => {
  it('lê message/code/receiptType do JSON dentro do Blob', async () => {
    const blob = new Blob([JSON.stringify(MISSING_BODY)], { type: 'application/json' });
    const parsed = await parseBlobError({ response: { status: 404, data: blob } });
    expect(getErrorMessage(parsed)).toBe(MISSING_BODY.message);
    expect(getMissingReceiptTemplateType(parsed)).toBe(ReceiptType.RESIDENT_CONTRIBUTION);
    expect(isNotFoundError(parsed)).toBe(true);
  });

  it('usa FileReader quando o Blob não tem .text()', async () => {
    const blob = new Blob([JSON.stringify(MISSING_BODY)]);
    Object.defineProperty(blob, 'text', { value: undefined });
    const parsed = await parseBlobError({ response: { status: 404, data: blob } });
    expect(getErrorCode(parsed)).toBe('RECEIPT_TEMPLATE_MISSING');
  });

  it('Blob que não é JSON volta intacto', async () => {
    const error = { response: { status: 500, data: new Blob(['<html>erro</html>']) } };
    await expect(parseBlobError(error)).resolves.toBe(error);
  });

  it('erro sem Blob volta intacto', async () => {
    const plain = { response: { data: { message: 'x' } } };
    await expect(parseBlobError(plain)).resolves.toBe(plain);
    const network = new Error('rede');
    await expect(parseBlobError(network)).resolves.toBe(network);
  });
});

describe('isNotFoundError', () => {
  it('reconhece só o 404 da API', () => {
    expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
    expect(isNotFoundError({ response: { status: 500 } })).toBe(false);
    expect(isNotFoundError(new Error('rede'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});
