import {
  ACTIVE_RESIDENT_STATUSES,
  ResidentStatus,
  TemplateAvailability,
  isResidentStatusActive,
  isTemplateAvailableForStatus,
} from '@fonte/types';

// Story 160 — tabela-verdade do predicado COMPARTILHADO (backend e adm.fonte
// usam este mesmo helper). É o teste que trava as decisões 2 e 3 do plano:
// PRE_ADMISSION conta como ATIVO (senão o wizard de acolhimento não imprimiria a
// ficha marcada ACTIVE_ONLY) e ARCHIVED/CENSUS_ADDED/REJECTED_CENSUS ficam do
// lado inativo, junto de DISCHARGED e EVADED.

const ACTIVE: ResidentStatus[] = [
  ResidentStatus.PRE_ADMISSION,
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
];

const INACTIVE: ResidentStatus[] = [
  ResidentStatus.DISCHARGED,
  ResidentStatus.EVADED,
  ResidentStatus.CENSUS_ADDED,
  ResidentStatus.REJECTED_CENSUS,
  ResidentStatus.ARCHIVED,
];

describe('ACTIVE_RESIDENT_STATUSES (story 160)', () => {
  it('cobre exatamente os quatro status de filho presente/em tratamento', () => {
    expect([...ACTIVE_RESIDENT_STATUSES].sort()).toEqual([...ACTIVE].sort());
  });

  it('particiona os 9 status do enum sem sobra nem sobreposição', () => {
    const all = Object.values(ResidentStatus);
    expect(all).toHaveLength(9);
    expect([...ACTIVE, ...INACTIVE].sort()).toEqual([...all].sort());
    expect(ACTIVE.filter((s) => INACTIVE.includes(s))).toEqual([]);
  });
});

describe('isResidentStatusActive', () => {
  it.each(ACTIVE)('%s é ativo', (status) => {
    expect(isResidentStatusActive(status)).toBe(true);
  });

  it.each(INACTIVE)('%s não é ativo', (status) => {
    expect(isResidentStatusActive(status)).toBe(false);
  });

  it('status ausente não é ativo', () => {
    expect(isResidentStatusActive(null)).toBe(false);
    expect(isResidentStatusActive(undefined)).toBe(false);
  });
});

describe('isTemplateAvailableForStatus — tabela-verdade 9 status × 3 valores', () => {
  it.each(Object.values(ResidentStatus))('ALL vale para %s', (status) => {
    expect(isTemplateAvailableForStatus(TemplateAvailability.ALL, status)).toBe(true);
  });

  it.each(ACTIVE)('ACTIVE_ONLY vale para %s', (status) => {
    expect(isTemplateAvailableForStatus(TemplateAvailability.ACTIVE_ONLY, status)).toBe(true);
    expect(isTemplateAvailableForStatus(TemplateAvailability.INACTIVE_ONLY, status)).toBe(false);
  });

  it.each(INACTIVE)('INACTIVE_ONLY vale para %s', (status) => {
    expect(isTemplateAvailableForStatus(TemplateAvailability.INACTIVE_ONLY, status)).toBe(true);
    expect(isTemplateAvailableForStatus(TemplateAvailability.ACTIVE_ONLY, status)).toBe(false);
  });

  // Regressão direta da decisão 3: mover PRE_ADMISSION para o lado inativo
  // travaria o gate "todos os obrigatórios assinados" do wizard de acolhimento.
  it('PRE_ADMISSION é ATIVO para efeito de disponibilidade (decisão 3)', () => {
    expect(isTemplateAvailableForStatus(TemplateAvailability.ACTIVE_ONLY, ResidentStatus.PRE_ADMISSION)).toBe(true);
    expect(isTemplateAvailableForStatus(TemplateAvailability.INACTIVE_ONLY, ResidentStatus.PRE_ADMISSION)).toBe(false);
  });

  it('ARCHIVED é INATIVO (registro morto do import em lote)', () => {
    expect(isTemplateAvailableForStatus(TemplateAvailability.INACTIVE_ONLY, ResidentStatus.ARCHIVED)).toBe(true);
    expect(isTemplateAvailableForStatus(TemplateAvailability.ACTIVE_ONLY, ResidentStatus.ARCHIVED)).toBe(false);
  });

  // Template legado (coluna criada com default) e payload sem o campo: nunca
  // somem da tela nem são recusados na geração.
  it('availableFor ausente ou desconhecido conta como ALL', () => {
    for (const status of Object.values(ResidentStatus)) {
      expect(isTemplateAvailableForStatus(undefined, status)).toBe(true);
      expect(isTemplateAvailableForStatus(null, status)).toBe(true);
      expect(isTemplateAvailableForStatus('QUALQUER_COISA', status)).toBe(true);
    }
  });

  it('sem status do filho, só ALL passa (nada de gerar no escuro)', () => {
    expect(isTemplateAvailableForStatus(TemplateAvailability.ALL, undefined)).toBe(true);
    expect(isTemplateAvailableForStatus(TemplateAvailability.ACTIVE_ONLY, undefined)).toBe(false);
    expect(isTemplateAvailableForStatus(TemplateAvailability.INACTIVE_ONLY, undefined)).toBe(false);
  });
});
