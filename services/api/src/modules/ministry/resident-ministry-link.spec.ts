import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { CreateResidentDto } from '../resident/dto/create-resident.dto';
import { UpdateResidentDto } from '../resident/dto/update-resident.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';

/**
 * Story 197 — a story é de SUBTRAÇÃO COMPLETA: meia remoção deixa rota que
 * responde 500, tela que renderiza lista vazia sem explicação e coluna órfã que
 * a próxima pessoa acha que ainda vale. Este arquivo é a catraca disso.
 */

// O pipe é o mesmo configurado no `main.ts` — é ele que transforma "campo que
// não existe mais no DTO" em 400 para o cliente velho.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const HOUSE_ID = '22222222-2222-4222-8222-222222222222';

describe('DTO de filho recusa ministryId (story 197)', () => {
  it('POST /residents com ministryId no corpo → 400', async () => {
    await expect(
      pipe.transform(
        { name: 'Ana', houseId: HOUSE_ID, ministryId: '11111111-1111-4111-8111-111111111111' },
        { type: 'body', metatype: CreateResidentDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('PATCH /residents/:id com ministryId no corpo → 400', async () => {
    await expect(
      pipe.transform(
        { ministryId: '11111111-1111-4111-8111-111111111111' },
        { type: 'body', metatype: UpdateResidentDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('um corpo sem ministryId continua passando', async () => {
    await expect(
      pipe.transform({ name: 'Ana', houseId: HOUSE_ID }, { type: 'body', metatype: CreateResidentDto }),
    ).resolves.toMatchObject({ name: 'Ana', houseId: HOUSE_ID });
  });
});

describe('UpdateMinistryDto — só servo lidera (decisão 3)', () => {
  it('recusa leaderType RESIDENT', async () => {
    const errors = await validate(
      plainToInstance(UpdateMinistryDto, { leaderType: 'RESIDENT' } as never),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('leaderType');
  });

  it('aceita leaderType STAFF e leaderType nulo', async () => {
    expect(await validate(plainToInstance(UpdateMinistryDto, { leaderType: 'STAFF' }))).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateMinistryDto, { leaderType: null } as never))).toHaveLength(0);
  });
});

// ─── Varredura de resíduo ─────────────────────────────────────────────────────

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // As migrations são o único lugar onde `ministry_id` de filho pode
      // aparecer: a histórica que criou a coluna e a nova que a dropou.
      if (entry === 'migrations') continue;
      sourceFiles(full, acc);
      continue;
    }
    // Specs falam do campo removido de propósito (inclusive este arquivo).
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) acc.push(full);
  }
  return acc;
}

describe('varredura de resíduo do vínculo filho↔ministério', () => {
  const files = sourceFiles(SRC);

  it('encontra arquivos para varrer (a varredura não está vazia)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('nenhuma fonte fora das migrations liga residents/admissions a ministry_id', () => {
    const offenders = files.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /(residents|admissions)[^\n]*ministry_id|ministry_id[^\n]*(residents|admissions)/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('nenhuma fonte fora das migrations declara ministryId em filho ou acolhimento', () => {
    const offenders = files.filter((f) => {
      // Dentro do próprio módulo de ministério, `ministryId` é a PK do
      // ministério nas tabelas `ministry_staff`/`ministry_tasks` — legítimo. O
      // que a story matou é `ministryId` DE FILHO, fora daqui.
      if (/\/modules\/ministry\//.test(f.replace(/\\/g, '/'))) return false;
      return /\bministryId\b/.test(readFileSync(f, 'utf8'));
    });
    expect(offenders.map((f) => f.replace(/\\/g, '/').split('/src/')[1] ?? f)).toEqual([]);
  });
});
