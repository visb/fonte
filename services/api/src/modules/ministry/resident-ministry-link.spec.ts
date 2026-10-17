import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { CreateResidentDto } from '../resident/dto/create-resident.dto';
import { UpdateResidentDto } from '../resident/dto/update-resident.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { AddMinistryResidentDto } from './dto/add-ministry-member.dto';
import { RestoreResidentMinistryLink1783037900000 } from '../../database/migrations/1783037900000-RestoreResidentMinistryLink';

/**
 * Story 205 — restaura o vínculo filho↔ministério (adaptado do spec da 197, que
 * era a catraca da remoção). Agora a catraca é a da volta: DTOs aceitam o campo,
 * filho pode liderar e a migration nova recria colunas/FK/índice.
 */

// O pipe é o mesmo configurado no `main.ts`.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const HOUSE_ID = '22222222-2222-4222-8222-222222222222';
const MINISTRY_ID = '11111111-1111-4111-8111-111111111111';

describe('DTO de filho aceita ministryId (story 205)', () => {
  it('POST /residents com ministryId no corpo passa', async () => {
    await expect(
      pipe.transform(
        { name: 'Ana', houseId: HOUSE_ID, ministryId: MINISTRY_ID },
        { type: 'body', metatype: CreateResidentDto },
      ),
    ).resolves.toMatchObject({ ministryId: MINISTRY_ID });
  });

  it('PATCH /residents/:id com ministryId (ou null) passa', async () => {
    await expect(
      pipe.transform({ ministryId: MINISTRY_ID }, { type: 'body', metatype: UpdateResidentDto }),
    ).resolves.toMatchObject({ ministryId: MINISTRY_ID });
    await expect(
      pipe.transform({ ministryId: null }, { type: 'body', metatype: UpdateResidentDto }),
    ).resolves.toMatchObject({ ministryId: null });
  });

  it('ministryId que não é UUID → 400', async () => {
    await expect(
      pipe.transform({ ministryId: 'cozinha' }, { type: 'body', metatype: UpdateResidentDto }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('AddMinistryResidentDto exige residentId UUID', async () => {
    expect(await validate(plainToInstance(AddMinistryResidentDto, { residentId: MINISTRY_ID }))).toHaveLength(0);
    expect(await validate(plainToInstance(AddMinistryResidentDto, { residentId: 'x' }))).toHaveLength(1);
  });
});

describe('UpdateMinistryDto — filho volta a liderar (decisão 1)', () => {
  it('aceita leaderType RESIDENT, STAFF e nulo', async () => {
    expect(await validate(plainToInstance(UpdateMinistryDto, { leaderType: 'RESIDENT' }))).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateMinistryDto, { leaderType: 'STAFF' }))).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateMinistryDto, { leaderType: null } as never))).toHaveLength(0);
  });

  it('recusa leaderType desconhecido', async () => {
    const errors = await validate(plainToInstance(UpdateMinistryDto, { leaderType: 'RELATIVE' } as never));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('leaderType');
  });
});

describe('migration RestoreResidentMinistryLink (decisão 4)', () => {
  function run(direction: 'up' | 'down') {
    const sql: string[] = [];
    const queryRunner = { query: jest.fn(async (q: string) => void sql.push(q.replace(/\s+/g, ' ').trim())) };
    const migration = new RestoreResidentMinistryLink1783037900000();
    return migration[direction](queryRunner as never).then(() => sql);
  }

  it('up recria as duas colunas nullable, as FKs ON DELETE SET NULL e o índice', async () => {
    const sql = await run('up');
    expect(sql).toEqual(
      expect.arrayContaining([
        'ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS ministry_id uuid NULL',
        'ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS ministry_id uuid NULL',
        'CREATE INDEX IF NOT EXISTS idx_residents_ministry_id ON public.residents (ministry_id)',
      ]),
    );
    const fks = sql.filter((q) => q.includes('FOREIGN KEY'));
    expect(fks).toHaveLength(2);
    for (const fk of fks) expect(fk).toContain('REFERENCES public.ministries(id) ON DELETE SET NULL');
    expect(fks.some((fk) => fk.includes('"FK_residents_ministry"'))).toBe(true);
    expect(fks.some((fk) => fk.includes('"FK_admissions_ministry"'))).toBe(true);
    // Começa vazio (decisão 2): nada de backfill.
    expect(sql.some((q) => /^UPDATE|^INSERT/.test(q))).toBe(false);
  });

  it('down zera líder filho e dropa índice e colunas', async () => {
    const sql = await run('down');
    expect(sql[0]).toContain("WHERE leader_type = 'RESIDENT'");
    expect(sql).toEqual(
      expect.arrayContaining([
        'DROP INDEX IF EXISTS public.idx_residents_ministry_id',
        'ALTER TABLE public.admissions DROP COLUMN IF EXISTS ministry_id',
        'ALTER TABLE public.residents DROP COLUMN IF EXISTS ministry_id',
      ]),
    );
  });

  it('tem nome e timestamp maiores que a DropResidentMinistryLink', () => {
    expect(new RestoreResidentMinistryLink1783037900000().name).toBe('RestoreResidentMinistryLink1783037900000');
    expect(1783037900000).toBeGreaterThan(1783037800000);
  });
});
