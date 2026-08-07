import { describe, expect, it } from 'vitest';
import type { DocumentTemplate, ResidentDocument } from '@fonte/api-client';
import { ResidentStatus, TemplateAvailability } from '@fonte/types';
import { allRequiredDocsSigned, requiredTemplatesForStatus } from './admissionGate';

function template(over: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 't1',
    name: 'Ficha',
    content: '',
    isRequired: true,
    signAtAdmission: false,
    availableFor: TemplateAvailability.ALL,
    updatedAt: '2026-06-01T12:00:00.000Z',
    ...over,
  } as DocumentTemplate;
}

function signedDoc(templateId: string, signed = true): ResidentDocument {
  return { templateId, signed } as ResidentDocument;
}

describe('requiredTemplatesForStatus (story 160)', () => {
  it('ignora os não-obrigatórios', () => {
    const out = requiredTemplatesForStatus(
      [template({ id: 'a' }), template({ id: 'b', isRequired: false })],
      ResidentStatus.ACTIVE,
    );
    expect(out.map((t) => t.id)).toEqual(['a']);
  });

  it('descarta o obrigatório que não vale para o status do filho', () => {
    const out = requiredTemplatesForStatus(
      [
        template({ id: 'ficha', availableFor: TemplateAvailability.ACTIVE_ONLY }),
        template({ id: 'alta', availableFor: TemplateAvailability.INACTIVE_ONLY }),
        template({ id: 'geral' }),
      ],
      ResidentStatus.PRE_ADMISSION,
    );
    expect(out.map((t) => t.id)).toEqual(['ficha', 'geral']);
  });
});

describe('allRequiredDocsSigned (gate do wizard, story 160)', () => {
  // O ponto da story: um obrigatório marcado "só não-ativos" travaria o
  // acolhimento para sempre — é impossível assinar um documento que o backend
  // se recusa a gerar para um filho em pré-admissão.
  it('obrigatório INACTIVE_ONLY não trava o gate do acolhimento', () => {
    const templates = [
      template({ id: 'ficha', availableFor: TemplateAvailability.ACTIVE_ONLY }),
      template({ id: 'alta', availableFor: TemplateAvailability.INACTIVE_ONLY }),
    ];
    expect(allRequiredDocsSigned(templates, [signedDoc('ficha')], ResidentStatus.PRE_ADMISSION)).toBe(true);
  });

  it('obrigatório disponível e não assinado mantém o gate fechado', () => {
    const templates = [template({ id: 'ficha', availableFor: TemplateAvailability.ACTIVE_ONLY })];
    expect(allRequiredDocsSigned(templates, [], ResidentStatus.ACTIVE)).toBe(false);
    expect(allRequiredDocsSigned(templates, [signedDoc('ficha', false)], ResidentStatus.ACTIVE)).toBe(false);
  });

  it('sem obrigatório nenhum o gate abre', () => {
    expect(allRequiredDocsSigned([], [], ResidentStatus.ACTIVE)).toBe(true);
  });

  // Filho ainda carregando: só os ALL entram na conta (mesmo predicado do backend).
  it('sem status, só os obrigatórios ALL são cobrados', () => {
    const templates = [
      template({ id: 'geral' }),
      template({ id: 'ficha', availableFor: TemplateAvailability.ACTIVE_ONLY }),
    ];
    expect(allRequiredDocsSigned(templates, [signedDoc('geral')], undefined)).toBe(true);
    expect(allRequiredDocsSigned(templates, [], undefined)).toBe(false);
  });
});
