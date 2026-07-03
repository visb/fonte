import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CheckImportConflictResult, ImportConflict } from '@fonte/types';
import { normalizeName } from '../../common/lib/normalize';
import { Resident } from './resident.entity';
import { Relative } from '../relative/relative.entity';
import { ResidentService } from './resident.service';
import { ResidentFollowUpService } from '../resident-follow-up/resident-follow-up.service';
import { CommitImportDto } from './dto/commit-import.dto';

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

      // Reusa a regra de criação (resident + admissão + carnê), na transação.
      const created = await this.residentService.create(dto.resident, manager);

      // Relatives (regra crítica: ≥1, garantida no DTO por @ArrayMinSize).
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
