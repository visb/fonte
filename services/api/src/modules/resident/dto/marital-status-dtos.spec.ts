import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MaritalStatus } from '@fonte/types';
import { CreateResidentDto } from './create-resident.dto';
import { UpdateResidentDto } from './update-resident.dto';
import { ReadmitResidentDto } from './readmit-resident.dto';
import { CreateStaffDto } from '../../staff/dto/create-staff.dto';

/** Story 210 — estado civil aceita "União estável" e "Viúvo(a)" em filhos e servos. */
describe('maritalStatus nos DTOs de resident e staff', () => {
  const DTOS = [
    ['CreateResidentDto', CreateResidentDto],
    ['UpdateResidentDto', UpdateResidentDto],
    ['ReadmitResidentDto', ReadmitResidentDto],
    ['CreateStaffDto', CreateStaffDto],
  ] as const;

  async function maritalErrors(cls: new () => object, maritalStatus: unknown): Promise<boolean> {
    const dto = plainToInstance(cls, { maritalStatus });
    const errors = await validate(dto);
    return errors.some((e) => e.property === 'maritalStatus');
  }

  describe.each(DTOS)('%s', (_name, cls) => {
    it.each(Object.values(MaritalStatus))('aceita %s', async (value) => {
      expect(await maritalErrors(cls, value)).toBe(false);
    });

    it('reprova valor fora do enum', async () => {
      expect(await maritalErrors(cls, 'SEPARATED')).toBe(true);
    });
  });

  it('o enum tem os 5 valores da story 210', () => {
    expect(Object.values(MaritalStatus)).toEqual([
      'SINGLE',
      'MARRIED',
      'STABLE_UNION',
      'DIVORCED',
      'WIDOWED',
    ]);
  });
});
