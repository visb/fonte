import { describe, expect, it } from 'vitest';
import { FamilyInvestment, ResidentStatus } from '@fonte/types';
import type { House, ImportPreviewResult } from '@fonte/api-client';
import type { ResidentFormData } from './residentSchema';
import {
  buildCommitPayload,
  buildCommitPayloadFromPreview,
  previewToFormValues,
  relativesFromPreview,
  resolveHouseId,
} from './importCommit';

const houses = [
  { id: 'h1', name: 'Casa Betânia' },
  { id: 'h2', name: 'Casa Nazaré' },
] as House[];

function preview(over: Partial<ImportPreviewResult> = {}): ImportPreviewResult {
  return {
    resident: { name: 'João Silva', cpf: '123.456.789-00', entryDate: '2023-02-10' },
    relatives: [{ name: 'Maria', phone: '999998888', relationship: 'Mãe' }],
    warnings: {},
    houseName: 'Betania',
    rawText: '',
    photoBase64: 'data:image/png;base64,abc',
    matchedHouseName: 'Casa Betânia',
    contributionMonths: ['2023-02-01', '2023-03-01'],
    matchStatus: 'matched',
    ...over,
  };
}

describe('previewToFormValues', () => {
  it('filtra só os campos do form e converte números para string', () => {
    const values = previewToFormValues({ name: 'Ana', children: 2, unknown: 'x', empty: '' });
    expect(values).toEqual({ name: 'Ana', children: '2' });
    expect(values).not.toHaveProperty('unknown');
    expect(values).not.toHaveProperty('empty');
  });

  it('mascara o contactPhone cru e assume DDD 41 quando sem DDD', () => {
    const values = previewToFormValues({ name: 'Ana', contactPhone: '999998888' });
    expect(values.contactPhone).toBe('(41) 99999-8888');
  });

  it('preserva o DDD presente ao mascarar o contactPhone', () => {
    const values = previewToFormValues({ name: 'Ana', contactPhone: '11999998888' });
    expect(values.contactPhone).toBe('(11) 99999-8888');
  });
});

describe('resolveHouseId', () => {
  it('casa por nome normalizado (sem acento) — ficha ⊂ casa', () => {
    expect(resolveHouseId('Betania', houses)).toBe('h1');
  });
  it('casa por inclusão inversa (casa ⊂ ficha)', () => {
    expect(resolveHouseId('Casa Betânia (masculina)', houses)).toBe('h1');
  });
  it('devolve vazio sem nome ou sem match', () => {
    expect(resolveHouseId(null, houses)).toBe('');
    expect(resolveHouseId('Inexistente', houses)).toBe('');
  });
});

describe('relativesFromPreview', () => {
  it('mapeia nome/parentesco, descarta sem nome e mascara+prefixa DDD 41 no telefone cru', () => {
    const result = relativesFromPreview(
      preview({ relatives: [{ name: 'Maria', phone: '999998888', relationship: 'Mãe' }, { name: '  ', phone: '', relationship: '' }] }),
    );
    expect(result).toEqual([{ name: 'Maria', phone: '(41) 99999-8888', relationship: 'Mãe' }]);
  });

  it('preserva o DDD já presente no telefone do familiar', () => {
    const result = relativesFromPreview(
      preview({ relatives: [{ name: 'Maria', phone: '11999998888', relationship: 'Mãe' }] }),
    );
    expect(result[0].phone).toBe('(11) 99999-8888');
  });
});

describe('buildCommitPayload', () => {
  it('usa ACTIVE quando o status não vem preenchido', () => {
    const form = { name: 'João', houseId: 'h1', familyInvestment: FamilyInvestment.SOCIAL } as ResidentFormData;
    const payload = buildCommitPayload(form, { relatives: [], contributionMonths: [] });
    expect(payload.resident.status).toBe(ResidentStatus.ACTIVE);
    expect(payload.contributionMonths).toEqual([]);
    expect(payload.photoBase64).toBeNull();
  });

  it('respeita o status escolhido no form', () => {
    const form = { name: 'João', houseId: 'h1', status: ResidentStatus.DISCHARGED } as ResidentFormData;
    const payload = buildCommitPayload(form, { relatives: [], contributionMonths: ['2023-01-01'] });
    expect(payload.resident.status).toBe(ResidentStatus.DISCHARGED);
    expect(payload.contributionMonths).toEqual(['2023-01-01']);
  });
});

describe('buildCommitPayloadFromPreview', () => {
  it('resolve casa, mapeia familiares, contribuições e foto', () => {
    const payload = buildCommitPayloadFromPreview(preview(), houses);
    expect(payload.resident.houseId).toBe('h1');
    expect(payload.resident.name).toBe('João Silva');
    expect(payload.relatives).toEqual([{ name: 'Maria', phone: '(41) 99999-8888', relationship: 'Mãe' }]);
    expect(payload.contributionMonths).toEqual(['2023-02-01', '2023-03-01']);
    expect(payload.photoBase64).toBe('data:image/png;base64,abc');
    expect(payload.resident.status).toBe(ResidentStatus.ACTIVE);
  });

  it('normaliza familiar sem telefone/parentesco (null) e trata campos ausentes', () => {
    const payload = buildCommitPayloadFromPreview(
      preview({
        relatives: [{ name: 'Ana', phone: undefined as never, relationship: undefined as never }],
        contributionMonths: undefined as never,
        photoBase64: null,
      }),
      houses,
    );
    expect(payload.relatives).toEqual([{ name: 'Ana', phone: null, relationship: null }]);
    expect(payload.contributionMonths).toEqual([]);
    expect(payload.photoBase64).toBeNull();
  });
});
