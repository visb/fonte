import { Role } from '@fonte/types';
import type { HouseStaffMember } from '@fonte/api-client';
import { sortHouseStaff, staffRoleLabel, whatsappUrl } from './constants';

function m(id: string, name: string, role: Role): HouseStaffMember {
  return { id, name, role, whatsapp: null, photoUrl: null, ledMinistries: [] };
}

describe('whatsappUrl', () => {
  it('normaliza número nacional com máscara para wa.me/55…', () => {
    expect(whatsappUrl('(62) 99999-0000')).toBe('https://wa.me/5562999990000');
    expect(whatsappUrl('6233334444')).toBe('https://wa.me/556233334444');
  });

  it('não duplica o 55 de número que já vem com DDI', () => {
    expect(whatsappUrl('+55 62 99999-0000')).toBe('https://wa.me/5562999990000');
  });

  it('sem número (ou sem dígito) → null', () => {
    expect(whatsappUrl(null)).toBeNull();
    expect(whatsappUrl(undefined)).toBeNull();
    expect(whatsappUrl('')).toBeNull();
    expect(whatsappUrl('---')).toBeNull();
  });
});

describe('sortHouseStaff', () => {
  it('coordenadores primeiro, depois servos, por nome dentro de cada grupo', () => {
    const sorted = sortHouseStaff([
      m('1', 'Zeca', Role.SERVANT),
      m('2', 'Bruno', Role.COORDINATOR),
      m('3', 'Ana', Role.SERVANT),
      m('4', 'Álvaro', Role.COORDINATOR),
      m('5', 'Outro', Role.ADMIN),
    ]);
    expect(sorted.map((s) => s.name)).toEqual(['Álvaro', 'Bruno', 'Ana', 'Zeca', 'Outro']);
  });

  it('não muta a lista recebida', () => {
    const input = [m('1', 'B', Role.SERVANT), m('2', 'A', Role.SERVANT)];
    sortHouseStaff(input);
    expect(input.map((s) => s.name)).toEqual(['B', 'A']);
  });
});

describe('staffRoleLabel', () => {
  it('rotula os papéis de staff', () => {
    expect(staffRoleLabel(Role.COORDINATOR)).toBe('Coordenador');
    expect(staffRoleLabel(Role.SERVANT)).toBe('Servo');
    expect(staffRoleLabel(Role.ADMIN)).toBe('Administrador');
  });
});
