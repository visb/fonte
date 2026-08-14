import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileType } from '@fonte/types';
import { toDbTimestamp } from '../../common/lib/db-timestamp';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import {
  ConsentPurpose,
  ConsentRecord,
  ConsentSubjectType,
} from './consent-record.entity';

export interface ConsentStatusView {
  purpose: ConsentPurpose;
  granted: boolean;
  termVersion: string | null;
  since: Date | null;
}

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentRecord)
    private readonly repo: Repository<ConsentRecord>,
    @InjectRepository(Relative)
    private readonly relativeRepo: Repository<Relative>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
  ) {}

  // Resolve o titular (subject) a partir do usuário autenticado, para fluxos de
  // autoatendimento (familiar/interno gerindo o próprio consentimento).
  async resolveSubjectForUser(
    userId: string,
    profileType: string,
  ): Promise<{ subjectType: ConsentSubjectType; subjectId: string }> {
    if (profileType === ProfileType.RELATIVE) {
      const relative = await this.relativeRepo.findOne({ where: { userId } });
      if (!relative) throw new NotFoundException('Perfil de familiar não encontrado');
      return { subjectType: 'RELATIVE', subjectId: relative.id };
    }
    if (profileType === ProfileType.RESIDENT) {
      const resident = await this.residentRepo.findOne({ where: { userId } });
      if (!resident) throw new NotFoundException('Perfil de interno não encontrado');
      return { subjectType: 'RESIDENT', subjectId: resident.id };
    }
    throw new ForbiddenException();
  }

  private write(
    subjectType: ConsentSubjectType,
    subjectId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    termVersion: string | null,
    recordedByUserId: string | null,
  ): Promise<ConsentRecord> {
    const record = this.repo.create({
      subjectType,
      subjectId,
      purpose,
      granted,
      termVersion,
      recordedByUserId,
    });
    return this.repo.save(record);
  }

  grant(
    subjectType: ConsentSubjectType,
    subjectId: string,
    purpose: ConsentPurpose,
    termVersion: string | null,
    recordedByUserId: string | null,
  ): Promise<ConsentRecord> {
    return this.write(subjectType, subjectId, purpose, true, termVersion, recordedByUserId);
  }

  revoke(
    subjectType: ConsentSubjectType,
    subjectId: string,
    purpose: ConsentPurpose,
    recordedByUserId: string | null,
  ): Promise<ConsentRecord> {
    return this.write(subjectType, subjectId, purpose, false, null, recordedByUserId);
  }

  // Estado atual = linha mais recente para (subject, purpose).
  async latest(
    subjectType: ConsentSubjectType,
    subjectId: string,
    purpose: ConsentPurpose,
  ): Promise<ConsentRecord | null> {
    return this.repo.findOne({
      where: { subjectType, subjectId, purpose },
      order: { createdAt: 'DESC' },
    });
  }

  async hasActiveConsent(
    subjectType: ConsentSubjectType,
    subjectId: string,
    purpose: ConsentPurpose,
  ): Promise<boolean> {
    const last = await this.latest(subjectType, subjectId, purpose);
    return last?.granted === true;
  }

  // Estado consolidado por finalidade para um titular.
  async statusForSubject(
    subjectType: ConsentSubjectType,
    subjectId: string,
  ): Promise<ConsentStatusView[]> {
    const purposes: ConsentPurpose[] = ['IMAGE_PUBLICATION', 'RELIGIOUS_DISCLOSURE'];
    const result: ConsentStatusView[] = [];
    for (const purpose of purposes) {
      const last = await this.latest(subjectType, subjectId, purpose);
      result.push({
        purpose,
        granted: last?.granted === true,
        termVersion: last?.termVersion ?? null,
        since: last?.createdAt ?? null,
      });
    }
    return result;
  }

  /**
   * Lote (story 177): registros de N titulares numa consulta só, para o snapshot
   * offline da casa.
   *
   * O recorte do delta é por `created_at` porque a tabela é **append-only**: uma
   * revogação é uma linha nova com `granted: false`, nunca um UPDATE. Por isso
   * também não existe "consentimento apagado" — consent nunca entra em `deleted`.
   */
  async findForSubjects(
    subjectType: ConsentSubjectType,
    subjectIds: string[],
    since?: Date,
  ): Promise<ConsentRecord[]> {
    if (subjectIds.length === 0) return [];

    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.subject_type = :subjectType', { subjectType })
      .andWhere('c.subject_id IN (:...subjectIds)', { subjectIds })
      .orderBy('c.created_at', 'DESC');

    if (since) qb.andWhere('c.created_at > :since', { since: toDbTimestamp(since) });

    return qb.getMany();
  }

  history(subjectType: ConsentSubjectType, subjectId: string): Promise<ConsentRecord[]> {
    return this.repo.find({
      where: { subjectType, subjectId },
      order: { createdAt: 'DESC' },
    });
  }
}
