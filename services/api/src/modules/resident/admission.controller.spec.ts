import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Role } from '@fonte/types';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AdmissionController } from './admission.controller';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

function roles(handler: unknown): Role[] {
  return Reflect.getMetadata(ROLES_KEY, handler as object);
}

describe('AdmissionController (story 215)', () => {
  const service = {
    createAdmission: jest.fn().mockResolvedValue({ id: 'a1' }),
    updateAdmission: jest.fn().mockResolvedValue({ id: 'a1' }),
  };
  const controller = new AdmissionController(service as never);

  it('delega criação e edição ao service', async () => {
    const body = { entryDate: '2020-01-01', exitDate: '2020-02-01', status: 'DISCHARGED' } as never;
    await controller.create('r1', body);
    await controller.update('r1', 'a1', { entryDate: '2020-01-02' });
    expect(service.createAdmission).toHaveBeenCalledWith('r1', body);
    expect(service.updateAdmission).toHaveBeenCalledWith('r1', 'a1', { entryDate: '2020-01-02' });
  });

  it('só ADMIN escreve passagens', () => {
    expect(roles(AdmissionController.prototype.create)).toEqual([Role.ADMIN]);
    expect(roles(AdmissionController.prototype.update)).toEqual([Role.ADMIN]);
  });

  describe('DTOs', () => {
    const create = (value: unknown) => pipe.transform(value, { type: 'body', metatype: CreateAdmissionDto });
    const update = (value: unknown) => pipe.transform(value, { type: 'body', metatype: UpdateAdmissionDto });

    it('criação exige entrada, saída e status', async () => {
      await expect(create({ entryDate: '2020-01-01', status: 'DISCHARGED' })).rejects.toThrow();
      await expect(create({ exitDate: '2020-01-01', status: 'DISCHARGED' })).rejects.toThrow();
      await expect(create({ entryDate: '2020-01-01', exitDate: '2020-02-01' })).rejects.toThrow();
      await expect(
        create({ entryDate: '2020-01-01', exitDate: '2020-02-01', status: 'DISCHARGED', houseId: null }),
      ).resolves.toBeDefined();
    });

    it('criação recusa campo fora do contrato e casa que não é UUID', async () => {
      await expect(
        create({ entryDate: '2020-01-01', exitDate: '2020-02-01', status: 'DISCHARGED', weight: 80 }),
      ).rejects.toThrow();
      await expect(
        create({ entryDate: '2020-01-01', exitDate: '2020-02-01', status: 'DISCHARGED', houseId: 'x' }),
      ).rejects.toThrow();
    });

    it('edição aceita parcial mas não datas/status nulos', async () => {
      await expect(update({ entryDate: '2020-01-01' })).resolves.toBeDefined();
      await expect(update({ houseId: null })).resolves.toBeDefined();
      await expect(update({ exitDate: null })).rejects.toThrow();
      await expect(update({ entryDate: null })).rejects.toThrow();
      await expect(update({ status: null })).rejects.toThrow();
      await expect(update({ status: 'NOPE' })).rejects.toThrow();
    });
  });
});
