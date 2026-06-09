import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileType } from '@fonte/types';
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

  history(subjectType: ConsentSubjectType, subjectId: string): Promise<ConsentRecord[]> {
    return this.repo.find({
      where: { subjectType, subjectId },
      order: { createdAt: 'DESC' },
    });
  }
}
