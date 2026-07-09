import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CheckImportConflictResult, ImportConflict, ResidentStatus } from '@fonte/types';
import { normalizeName } from '../../common/lib/normalize';
import { Resident } from './resident.entity';
import { Admission } from './admission.entity';
import { Relative } from '../relative/relative.entity';
import { ResidentService } from './resident.service';
import { ResidentFollowUpService } from '../resident-follow-up/resident-follow-up.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { CreateResidentDto } from './dto/create-resident.dto';
import { ImportAdmissionDto } from './dto/import-admission.dto';
import { deriveExitStatus } from './import.util';

/** Só os dígitos de um texto (para comparar CPFs de formatos diferentes). */
function digitsOnly(text: string | null | undefined): string {
  return (text ?? '').replace(/\D/g, '');
}

/** Extensão de arquivo por mime de imagem, para nomear a foto no bucket. */
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Converte a foto em base64 da ficha (data URL `data:<mime>;base64,<...>` ou
 * base64 cru) num objeto compatível com o caminho de upload de foto existente
 * (`ResidentService.uploadPhoto`, que só usa buffer/mimetype/originalname).
 */
function base64ToFile(photoBase64: string): Express.Multer.File {
  const match = /^data:(?<mime>[^;]+);base64,(?<data>.+)$/s.exec(photoBase64);
  const mimetype = match?.groups?.mime ?? 'image/jpeg';
  const data = match?.groups?.data ?? photoBase64;
  const buffer = Buffer.from(data, 'base64');
  const ext = IMAGE_EXT[mimetype] ?? 'jpg';
  return {
    buffer,
    mimetype,
    originalname: `import-photo.${ext}`,
    size: buffer.length,
  } as Express.Multer.File;
}

/**
 * Detecção de conflito e commit atômico do import de filho (story 103). O
 * commit reusa a regra de criação (`ResidentService.create`), o caminho de
 * upload de foto (`ResidentService.uploadPhoto`) e a criação de contribuições
 * retroativas (`ResidentFollowUpService.bulkCreateContributions`), tudo numa
 * única transação — rollback não deixa nada persistido.
 */
@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    private readonly residentService: ResidentService,
    private readonly followUpService: ResidentFollowUpService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Filhos já cadastrados que conflitam com a ficha a importar — casa por nome
   * normalizado (sem acento) **ou** por CPF (dígitos). O `find` do TypeORM já
   * ignora soft-deleted (`deleted_at`). Regra de negócio: vive no service.
   */
  async checkConflict(name?: string, cpf?: string): Promise<CheckImportConflictResult> {
    const normalizedName = name ? normalizeName(name) : '';
    const cpfDigits = digitsOnly(cpf);
    if (!normalizedName && !cpfDigits) return { conflicts: [] };

    const residents = await this.residentRepository.find({ relations: ['house'] });
    const conflicts: ImportConflict[] = residents
      .filter((r) => {
        const nameMatch = normalizedName !== '' && normalizeName(r.name) === normalizedName;
        const cpfMatch = cpfDigits !== '' && digitsOnly(r.cpf) === cpfDigits;
        return nameMatch || cpfMatch;
      })
      .map((r) => ({
        id: r.id,
        name: r.name,
        cpf: r.cpf ?? null,
        status: r.status,
        houseName: r.house?.name ?? null,
      }));

    return { conflicts };
  }

  /**
   * Fichas cujo nome de arquivo casa com um filho já cadastrado. Roda ANTES da
   * extração por IA: nomes de arquivo tipo "FICHA João da Silva.docx" carregam
   * o nome do filho — se ele já existe no banco, não precisamos gastar crédito
   * do modelo re-extraindo a ficha. Match: o nome normalizado do filho aparece
   * como sequência de palavras no nome do arquivo limpo (sem extensão,
   * separadores e dígitos); nome de uma palavra só exige igualdade exata para
   * não gerar falso positivo.
   */
  async checkImportedFiles(
    fileNames: string[],
  ): Promise<{ matches: Array<{ fileName: string; residentId: string; residentName: string }> }> {
    const wanted = fileNames.map((n) => n.trim()).filter(Boolean);
    if (wanted.length === 0) return { matches: [] };

    // `find` do TypeORM já exclui soft-deleted.
    const residents = await this.residentRepository.find({ select: ['id', 'name'] });
    const candidates = residents
      .map((r) => ({ id: r.id, name: r.name, normalized: normalizeName(r.name) }))
      .filter((c) => c.normalized.length > 0);

    const matches: Array<{ fileName: string; residentId: string; residentName: string }> = [];
    for (const fileName of wanted) {
      const cleaned = normalizeName(
        fileName
          .replace(/\.[^.]+$/, '') // extensão
          .replace(/[_\-.()[\]]+/g, ' ') // separadores comuns
          .replace(/\d+/g, ' '), // numeração de arquivo
      );
      if (!cleaned) continue;
      const hit = candidates.find((c) =>
        c.normalized.includes(' ')
          ? ` ${cleaned} `.includes(` ${c.normalized} `)
          : cleaned === c.normalized,
      );
      if (hit) matches.push({ fileName, residentId: hit.id, residentName: hit.name });
    }
    return { matches };
  }

  /**
   * Persiste o import aprovado de forma atômica: revalida o conflito por CPF,
   * cria o resident + relatives, anexa a foto (se houver) e cria as
   * contribuições retroativas — tudo numa transação. `actingUserId` atribui o
   * autor das contribuições (o admin/coordenador que aprovou).
   */
  async commit(
    dto: CommitImportDto,
    actingUserId: string,
  ): Promise<{ resident: Resident; contributionsCreated: { created: number; skipped: number } }> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertNoCpfConflict(manager, dto.resident.cpf);

      // Filho que já saiu não pode entrar ATIVO: deriva ALTA/EVASÃO pela
      // permanência (story 120) antes de reusar a regra de criação.
      this.applyExitStatus(dto.resident);

      // Reusa a regra de criação (resident + admissão do topo + carnê), na
      // transação. O topo é o acolhimento mais recente (status já derivado acima).
      const created = await this.residentService.create(dto.resident, manager);

      // Histórico de acolhimentos (story 121): quando a planilha trouxe vários
      // pares entrada→saída, os anteriores ao mais recente viram `Admission`
      // extras, cada um com status derivado pela permanência (story 120). Tudo na
      // mesma transação → rollback não deixa acolhimento órfão.
      await this.createPreviousAdmissions(manager, created, dto.resident.admissions);

      // Relatives: pode vir vazio no import (ficha histórica sem familiar
      // conhecido); a regra "≥1 relative" vale só para o acolhimento manual.
      const relativeRepo = manager.getRepository(Relative);
      for (const rel of dto.relatives) {
        await relativeRepo.save(
          relativeRepo.create({
            residentId: created.id,
            name: rel.name,
            phone: rel.phone ?? null,
            relationship: rel.relationship ?? null,
          }),
        );
      }

      // Foto: reusa o caminho de upload existente (bucket + thumbnail).
      if (dto.photoBase64) {
        await this.residentService.uploadPhoto(created.id, base64ToFile(dto.photoBase64), manager);
      }

      // Contribuições retroativas: reusa bulkCreateContributions.
      const contributionsCreated = await this.followUpService.bulkCreateContributions(
        created.id,
        { months: dto.contributionMonths.map((date) => ({ date })) },
        actingUserId,
        manager,
      );

      const resident = (await manager
        .getRepository(Resident)
        .findOne({ where: { id: created.id }, relations: ['house', 'ministry', 'user'] }))!;

      return { resident, contributionsCreated };
    });
  }

  /**
   * Deriva o status terminal de um filho que já saiu, a partir da permanência
   * entrada→saída (story 120). Só age quando há `exitDate` **e** `entryDate` e o
   * status recebido é o default não-terminal (`ACTIVE`/`PRE_ADMISSION`/ausente):
   * permanência ≥ 6 meses → `DISCHARGED` (alta); < 6 meses → `EVADED` (evasão).
   * Status terminal escolhido explicitamente no modal é respeitado, e sem
   * `entryDate` não há como derivar → o status recebido é mantido (sem crash).
   */
  private applyExitStatus(resident: CreateResidentDto): void {
    const { entryDate, exitDate, status } = resident;
    if (!exitDate || !entryDate) return;
    const isDefaultStatus =
      status == null ||
      status === ResidentStatus.ACTIVE ||
      status === ResidentStatus.PRE_ADMISSION;
    if (!isDefaultStatus) return;
    resident.status = deriveExitStatus(entryDate, exitDate);
  }

  /**
   * Cria os acolhimentos anteriores do histórico (story 121). O topo (mais
   * recente) já foi criado por `ResidentService.create`; aqui inserimos os
   * demais pares entrada→saída como `Admission` extras, cada um com status
   * derivado pela permanência (regra dos 6 meses, story 120). Um acolhimento sem
   * saída (em aberto) fica `ACTIVE`. No mesmo manager → mesma transação do commit.
   */
  private async createPreviousAdmissions(
    manager: EntityManager,
    resident: Resident,
    admissions?: ImportAdmissionDto[] | null,
  ): Promise<void> {
    if (!admissions || admissions.length <= 1) return;

    const sorted = [...admissions].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
    const previous = sorted.slice(0, -1); // todos menos o mais recente (topo já criado)
    const admissionRepo = manager.getRepository(Admission);

    for (const adm of previous) {
      const status = adm.exitDate
        ? deriveExitStatus(adm.entryDate, adm.exitDate)
        : ResidentStatus.ACTIVE;
      await admissionRepo.save(
        admissionRepo.create({
          residentId: resident.id,
          houseId: resident.houseId,
          ministryId: null,
          entryDate: adm.entryDate as unknown as Date,
          exitDate: (adm.exitDate ?? null) as unknown as Date | null,
          status,
        }),
      );
    }
  }

  /** Idempotência: recusa (409) se já houver filho ativo com o mesmo CPF. */
  private async assertNoCpfConflict(manager: EntityManager, cpf?: string | null): Promise<void> {
    const cpfDigits = digitsOnly(cpf);
    if (!cpfDigits) return;
    const residents = await manager.getRepository(Resident).find({ select: ['id', 'cpf'] });
    const exists = residents.some((r) => digitsOnly(r.cpf) === cpfDigits);
    if (exists) {
      throw new ConflictException('Já existe um filho cadastrado com este CPF.');
    }
  }
}
