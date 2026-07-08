import { ConflictException } from '@nestjs/common';
import { ResidentStatus } from '@fonte/types';
import { ImportService } from './import.service';
import { CommitImportDto } from './dto/commit-import.dto';

/** Monta um filho mínimo (o que o `find` do repositório devolveria). */
function resident(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'João da Silva',
    cpf: '111.222.333-44',
    status: ResidentStatus.ACTIVE,
    house: { name: 'Casa Um' },
    ...overrides,
  };
}

/** Payload de commit mínimo com overrides. */
function commitDto(overrides: Partial<CommitImportDto> = {}): CommitImportDto {
  return {
    resident: { name: 'Maria', houseId: 'house-1', cpf: '555.666.777-88' } as never,
    relatives: [{ name: 'Pai da Maria', phone: '11999998888', relationship: 'Pai' }],
    contributionMonths: ['2024-01-01', '2024-02-01'],
    photoBase64: null,
    ...overrides,
  };
}

describe('ImportService', () => {
  describe('checkConflict', () => {
    let service: ImportService;
    const find = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      service = new ImportService(
        { find } as never,
        {} as never,
        {} as never,
        {} as never,
      );
    });

    it('acha por CPF (dígitos, ignorando formatação) mesmo com nome diferente', async () => {
      find.mockResolvedValue([
        resident({ id: 'a', name: 'Outro Nome', cpf: '11122233344' }),
        resident({ id: 'b', name: 'Mais Um', cpf: '99988877766' }),
      ]);

      const { conflicts } = await service.checkConflict('Zé Ninguém', '111.222.333-44');

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        id: 'a',
        name: 'Outro Nome',
        cpf: '11122233344',
        status: ResidentStatus.ACTIVE,
        houseName: 'Casa Um',
      });
    });

    it('acha por nome sem acento/caixa quando não há CPF', async () => {
      find.mockResolvedValue([resident({ id: 'c', name: 'José Antônio', cpf: null })]);

      const { conflicts } = await service.checkConflict('  jose   antonio ', undefined);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe('c');
    });

    it('retorna vazio quando não há nome nem cpf', async () => {
      const { conflicts } = await service.checkConflict('', '');
      expect(conflicts).toEqual([]);
      expect(find).not.toHaveBeenCalled();
    });

    it('retorna vazio quando nada casa', async () => {
      find.mockResolvedValue([resident({ id: 'd', name: 'Fulano', cpf: '00011122233' })]);
      const { conflicts } = await service.checkConflict('Beltrano', '444.555.666-77');
      expect(conflicts).toEqual([]);
    });

    it('não busca soft-deleted (delega ao find do TypeORM, que já os exclui)', async () => {
      find.mockResolvedValue([]);
      await service.checkConflict('Qualquer', '123');
      // find sem { withDeleted: true } → soft-deleted ficam de fora
      expect(find).toHaveBeenCalledWith({ relations: ['house'] });
    });
  });

  describe('commit', () => {
    let service: ImportService;
    const create = jest.fn();
    const uploadPhoto = jest.fn();
    const bulkCreateContributions = jest.fn();

    // Repositório do Resident dentro da transação.
    const residentTxFind = jest.fn();
    const residentTxFindOne = jest.fn();
    // Repositório do Relative dentro da transação.
    const relativeCreate = jest.fn((x) => x);
    const relativeSave = jest.fn((x) => Promise.resolve(x));
    // Repositório do Admission dentro da transação (histórico — story 121).
    const admissionCreate = jest.fn((x) => x);
    const admissionSave = jest.fn((x) => Promise.resolve(x));

    const managerMock = {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'Relative') {
          return { create: relativeCreate, save: relativeSave };
        }
        if (entity.name === 'Admission') {
          return { create: admissionCreate, save: admissionSave };
        }
        return { find: residentTxFind, findOne: residentTxFindOne };
      }),
    };
    const transaction = jest.fn(async (cb: (m: unknown) => unknown) => cb(managerMock));

    beforeEach(() => {
      jest.clearAllMocks();
      residentTxFind.mockResolvedValue([]); // sem conflito por padrão
      residentTxFindOne.mockResolvedValue(resident({ id: 'new-1', name: 'Maria' }));
      create.mockResolvedValue({ id: 'new-1', name: 'Maria' });
      bulkCreateContributions.mockResolvedValue({ created: 2, skipped: 0 });
      service = new ImportService(
        {} as never,
        { create, uploadPhoto } as never,
        { bulkCreateContributions } as never,
        { transaction } as never,
      );
    });

    it('cria resident + relatives + contribuições numa transação', async () => {
      const result = await service.commit(commitDto(), 'user-1');

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(commitDto().resident, managerMock);
      expect(relativeSave).toHaveBeenCalledTimes(1);
      expect(relativeSave).toHaveBeenCalledWith(
        expect.objectContaining({ residentId: 'new-1', name: 'Pai da Maria', phone: '11999998888' }),
      );
      expect(bulkCreateContributions).toHaveBeenCalledWith(
        'new-1',
        { months: [{ date: '2024-01-01' }, { date: '2024-02-01' }] },
        'user-1',
        managerMock,
      );
      expect(result.contributionsCreated).toEqual({ created: 2, skipped: 0 });
      expect(result.resident.id).toBe('new-1');
    });

    it('conflito por CPF existente → ConflictException e nada persistido (rollback)', async () => {
      residentTxFind.mockResolvedValue([resident({ id: 'dup', cpf: '55566677788' })]);

      await expect(service.commit(commitDto(), 'user-1')).rejects.toBeInstanceOf(ConflictException);

      expect(create).not.toHaveBeenCalled();
      expect(relativeSave).not.toHaveBeenCalled();
      expect(bulkCreateContributions).not.toHaveBeenCalled();
    });

    it('contributionMonths vazio não cria contribuição', async () => {
      bulkCreateContributions.mockResolvedValue({ created: 0, skipped: 0 });

      const result = await service.commit(commitDto({ contributionMonths: [] }), 'user-1');

      expect(bulkCreateContributions).toHaveBeenCalledWith('new-1', { months: [] }, 'user-1', managerMock);
      expect(result.contributionsCreated).toEqual({ created: 0, skipped: 0 });
    });

    it('anexa a foto quando photoBase64 presente', async () => {
      await service.commit(
        commitDto({ photoBase64: 'data:image/png;base64,aGVsbG8=' }),
        'user-1',
      );

      expect(uploadPhoto).toHaveBeenCalledTimes(1);
      const [residentId, file, mgr] = uploadPhoto.mock.calls[0];
      expect(residentId).toBe('new-1');
      expect(file.mimetype).toBe('image/png');
      expect(Buffer.isBuffer(file.buffer)).toBe(true);
      expect(mgr).toBe(managerMock);
    });

    it('não anexa foto quando ausente', async () => {
      await service.commit(commitDto({ photoBase64: null }), 'user-1');
      expect(uploadPhoto).not.toHaveBeenCalled();
    });

    it('base64 cru (sem data URL) assume image/jpeg', async () => {
      await service.commit(commitDto({ photoBase64: 'aGVsbG8=' }), 'user-1');
      const [, file] = uploadPhoto.mock.calls[0];
      expect(file.mimetype).toBe('image/jpeg');
      expect(file.originalname).toBe('import-photo.jpg');
    });

    it('sem CPF na ficha não revalida conflito (segue o commit)', async () => {
      // Mesmo com um filho existente, sem CPF a checagem por CPF é pulada.
      residentTxFind.mockResolvedValue([resident({ id: 'other', cpf: '99988877766' })]);
      const dto = commitDto();
      (dto.resident as { cpf?: string | null }).cpf = null;

      await service.commit(dto, 'user-1');

      expect(create).toHaveBeenCalledTimes(1);
    });

    // Story 120: filho que já saiu deriva ALTA/EVASÃO pela permanência.
    describe('derivação de status por data de saída (story 120)', () => {
      /** Ficha com entrada/saída (e status opcional) para o commit. */
      const withDates = (over: Record<string, unknown>) =>
        commitDto({
          resident: { name: 'Maria', houseId: 'house-1', cpf: '555.666.777-88', ...over } as never,
        });

      it('permanência ≥ 6 meses + status ausente → DISCHARGED com exitDate', async () => {
        await service.commit(
          withDates({ entryDate: '2023-01-10', exitDate: '2023-08-10' }),
          'user-1',
        );
        const dto = create.mock.calls[0][0];
        expect(dto.status).toBe(ResidentStatus.DISCHARGED);
        expect(dto.exitDate).toBe('2023-08-10');
      });

      it('permanência ≥ 6 meses + status ACTIVE → DISCHARGED (não fica ativo)', async () => {
        await service.commit(
          withDates({ entryDate: '2023-01-10', exitDate: '2023-08-10', status: ResidentStatus.ACTIVE }),
          'user-1',
        );
        expect(create.mock.calls[0][0].status).toBe(ResidentStatus.DISCHARGED);
      });

      it('permanência < 6 meses → EVADED com exitDate', async () => {
        await service.commit(
          withDates({ entryDate: '2023-01-10', exitDate: '2023-04-01' }),
          'user-1',
        );
        const dto = create.mock.calls[0][0];
        expect(dto.status).toBe(ResidentStatus.EVADED);
        expect(dto.exitDate).toBe('2023-04-01');
      });

      it('status terminal explícito (DISCHARGED) é preservado, não re-derivado', async () => {
        // Permanência < 6 meses, mas o operador escolheu ALTA: respeita a escolha.
        await service.commit(
          withDates({ entryDate: '2023-01-10', exitDate: '2023-04-01', status: ResidentStatus.DISCHARGED }),
          'user-1',
        );
        expect(create.mock.calls[0][0].status).toBe(ResidentStatus.DISCHARGED);
      });

      it('status terminal explícito (EVADED) é preservado mesmo com ≥ 6 meses', async () => {
        await service.commit(
          withDates({ entryDate: '2023-01-10', exitDate: '2023-08-10', status: ResidentStatus.EVADED }),
          'user-1',
        );
        expect(create.mock.calls[0][0].status).toBe(ResidentStatus.EVADED);
      });

      it('exitDate sem entryDate → mantém o status recebido, sem crash', async () => {
        await service.commit(
          withDates({ exitDate: '2023-08-10', status: ResidentStatus.ACTIVE }),
          'user-1',
        );
        expect(create.mock.calls[0][0].status).toBe(ResidentStatus.ACTIVE);
      });

      it('sem exitDate → comportamento atual (status como veio)', async () => {
        await service.commit(
          withDates({ entryDate: '2023-01-10', status: ResidentStatus.ACTIVE }),
          'user-1',
        );
        expect(create.mock.calls[0][0].status).toBe(ResidentStatus.ACTIVE);
      });
    });

    // Story 121: import de múltiplos acolhimentos (histórico na ficha).
    describe('histórico de acolhimentos (story 121)', () => {
      /** Commit com N acolhimentos + o topo (mais recente) já refletido no resident. */
      const withAdmissions = (
        admissions: { entryDate: string; exitDate: string | null }[],
        top: Record<string, unknown> = {},
      ) =>
        commitDto({
          resident: {
            name: 'Maria',
            houseId: 'house-1',
            cpf: '555.666.777-88',
            ...top,
            admissions,
          } as never,
        });

      beforeEach(() => {
        create.mockResolvedValue({ id: 'new-1', houseId: 'house-1', name: 'Maria' });
      });

      it('2 acolhimentos → topo via create + 1 Admission anterior, cada um com status derivado', async () => {
        // anterior 2022-01-10→2022-09-10 = 8 meses (≥6) → DISCHARGED
        // topo 2023-03-01→2023-05-01 = 2 meses (<6) → EVADED (derivado no create)
        await service.commit(
          withAdmissions(
            [
              { entryDate: '2022-01-10', exitDate: '2022-09-10' },
              { entryDate: '2023-03-01', exitDate: '2023-05-01' },
            ],
            { entryDate: '2023-03-01', exitDate: '2023-05-01' },
          ),
          'user-1',
        );

        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][0].status).toBe(ResidentStatus.EVADED);

        expect(admissionSave).toHaveBeenCalledTimes(1);
        expect(admissionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            residentId: 'new-1',
            houseId: 'house-1',
            entryDate: '2022-01-10',
            exitDate: '2022-09-10',
            status: ResidentStatus.DISCHARGED,
          }),
        );
      });

      it('acolhimento anterior com permanência < 6 meses → EVADED', async () => {
        await service.commit(
          withAdmissions(
            [
              { entryDate: '2022-01-10', exitDate: '2022-03-10' },
              { entryDate: '2023-03-01', exitDate: '2023-11-01' },
            ],
            { entryDate: '2023-03-01', exitDate: '2023-11-01' },
          ),
          'user-1',
        );
        expect(admissionCreate).toHaveBeenCalledWith(
          expect.objectContaining({ entryDate: '2022-01-10', status: ResidentStatus.EVADED }),
        );
      });

      it('payload fora de ordem → ordena por entrada e insere só o(s) anterior(es)', async () => {
        await service.commit(
          withAdmissions(
            [
              { entryDate: '2023-03-01', exitDate: '2023-11-01' }, // mais recente primeiro
              { entryDate: '2022-01-10', exitDate: '2022-09-10' },
            ],
            { entryDate: '2023-03-01', exitDate: '2023-11-01' },
          ),
          'user-1',
        );
        expect(admissionSave).toHaveBeenCalledTimes(1);
        expect(admissionCreate).toHaveBeenCalledWith(
          expect.objectContaining({ entryDate: '2022-01-10', exitDate: '2022-09-10' }),
        );
      });

      it('acolhimento anterior em aberto (sem saída) → status ACTIVE', async () => {
        await service.commit(
          withAdmissions(
            [
              { entryDate: '2022-01-10', exitDate: null },
              { entryDate: '2023-03-01', exitDate: '2023-11-01' },
            ],
            { entryDate: '2023-03-01', exitDate: '2023-11-01' },
          ),
          'user-1',
        );
        expect(admissionCreate).toHaveBeenCalledWith(
          expect.objectContaining({ entryDate: '2022-01-10', status: ResidentStatus.ACTIVE }),
        );
      });

      it('1 acolhimento só → nenhum Admission extra (regressão: só o topo)', async () => {
        await service.commit(
          withAdmissions([{ entryDate: '2023-03-01', exitDate: '2023-11-01' }], {
            entryDate: '2023-03-01',
            exitDate: '2023-11-01',
          }),
          'user-1',
        );
        expect(admissionSave).not.toHaveBeenCalled();
      });

      it('sem campo admissions → nenhum Admission extra (regressão)', async () => {
        await service.commit(commitDto(), 'user-1');
        expect(admissionSave).not.toHaveBeenCalled();
      });

      it('falha ao salvar o Admission extra → propaga o erro (transação atômica, sem órfã)', async () => {
        admissionSave.mockRejectedValueOnce(new Error('db down'));
        await expect(
          service.commit(
            withAdmissions(
              [
                { entryDate: '2022-01-10', exitDate: '2022-09-10' },
                { entryDate: '2023-03-01', exitDate: '2023-11-01' },
              ],
              { entryDate: '2023-03-01', exitDate: '2023-11-01' },
            ),
            'user-1',
          ),
        ).rejects.toThrow('db down');
        // o commit não avança para as contribuições após a falha no histórico
        expect(bulkCreateContributions).not.toHaveBeenCalled();
      });
    });
  });
});
