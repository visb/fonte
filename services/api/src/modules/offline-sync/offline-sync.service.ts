import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  HouseOfflineSnapshot,
  Role,
  SNAPSHOT_MAX_DELTA_AGE_DAYS,
} from '@fonte/types';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ConsentRecord } from '../consent/consent-record.entity';
import { ConsentService } from '../consent/consent.service';
import { MinistryService } from '../ministry/ministry.service';
import { Resident } from '../resident/resident.entity';
import { ResidentAttachment } from '../resident/resident-attachment.entity';
import { ResidentService } from '../resident/resident.service';
import {
  ResidentFollowUpService,
  ResidentFollowUpView,
} from '../resident-follow-up/resident-follow-up.service';
import {
  ResidentReceivableService,
  ResidentReceivableSummaryView,
} from '../resident-receivable/resident-receivable.service';
import { StaffService } from '../staff/staff.service';
import { OfflineSnapshotQueryDto } from './dto/offline-snapshot-query.dto';

type HouseMinistrySummary = Awaited<ReturnType<MinistryService['findByHouse']>>[number];

/** Formas concretas dos blocos do snapshot desta API. */
export interface HouseSnapshotShapes {
  resident: Resident;
  followUp: ResidentFollowUpView;
  consent: ConsentRecord;
  receivable: ResidentReceivableSummaryView;
  attachment: ResidentAttachment;
  ministry: HouseMinistrySummary;
}

export type HouseSnapshot = HouseOfflineSnapshot<HouseSnapshotShapes>;

/**
 * Folga aplicada ao `syncedAt` (decisão 7 da story 177). O snapshot é montado
 * por várias consultas; uma escrita commitada no meio delas tem `updated_at`
 * anterior ao "agora" do fim da montagem e ficaria fora do próximo delta para
 * sempre. Um segundo para trás custa reenviar alguns registros e evita perder
 * dado em silêncio.
 */
export const SNAPSHOT_CLOCK_SKEW_MS = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (result[k] ??= []).push(item);
  }
  return result;
}

/**
 * Snapshot offline da casa (story 177).
 *
 * Agrega, num payload só, o que o `ops.fonte` precisa ter no aparelho: antes
 * disso aquecer uma casa de 40 filhos custava ~200 requests a cada login e a
 * cada volta do foreground. O módulo é próprio (e não um puxadinho do
 * `ResidentService`) porque cruza cinco módulos e consome cada um pelo service.
 */
@Injectable()
export class OfflineSyncService {
  constructor(
    private readonly residents: ResidentService,
    private readonly followUps: ResidentFollowUpService,
    private readonly receivables: ResidentReceivableService,
    private readonly consents: ConsentService,
    private readonly ministries: MinistryService,
    private readonly staff: StaffService,
  ) {}

  async houseSnapshot(
    houseId: string,
    query: OfflineSnapshotQueryDto,
    user: AuthenticatedUser,
  ): Promise<HouseSnapshot> {
    await this.assertHouseAccess(houseId, user);

    // Relógio do SERVIDOR, com a folga da decisão 7. Calculado antes das
    // consultas: melhor reenviar do que perder escrita concorrente.
    const syncedAt = new Date(Date.now() - SNAPSHOT_CLOCK_SKEW_MS);
    const since = this.resolveSince(query.since);
    const full = since === null;

    const residents = await this.residents.findPresentByHouse(houseId, since ?? undefined);

    // No delta, os blocos de detalhe cobrem TODOS os filhos presentes, não só os
    // alterados: lançar um evento na timeline não muda a linha do filho.
    const presentIds = full
      ? residents.map((resident) => resident.id)
      : await this.residents.findPresentIdsByHouse(houseId);

    // Do carnê o pacote leva só o RECORTE (story 186): mês de referência e
    // status, nunca valor nem pagamento. É o que o `ops.fonte` precisa para
    // declarar contribuição em produtos, e por não ser financeiro desce para
    // toda role de staff. O carnê cheio continua fora daqui e a rota que o serve
    // (`GET /residents/:id/receivables`) segue ADMIN/COORDINATOR — o pacote
    // offline não é atalho de permissão. O recorte de `access_level` da timeline
    // (abaixo) continua valendo: aquele é por role.

    // Uma consulta por recurso — o N+1 que a story existe para matar. A contagem
    // de idas ao banco é constante em relação ao número de filhos da casa.
    const [followUps, receivables, consents, attachments, ministries] = await Promise.all([
      this.followUps.findByResidents(presentIds, user.role, since ?? undefined),
      this.receivables.findSummariesByResidents(presentIds, since ?? undefined),
      this.consents.findForSubjects('RESIDENT', presentIds, since ?? undefined),
      // Anexo não tem data de alteração: só desce para o filho que está no payload.
      this.residents.findAttachmentsByResidents(residents.map((resident) => resident.id)),
      this.ministries.findByHouse(houseId),
    ]);

    return {
      syncedAt: syncedAt.toISOString(),
      full,
      residents,
      followUps: groupBy(followUps, (item) => item.residentId),
      consents: groupBy(consents, (item) => item.subjectId),
      receivables: groupBy(receivables, (item) => item.residentId),
      attachments: groupBy(attachments, (item) => item.residentId),
      ministries,
      deleted: since ? await this.collectDeleted(houseId, presentIds, since) : emptyDeleted(),
    };
  }

  /**
   * Endpoint que despeja a casa inteira é o alvo óbvio: só staff **da própria
   * casa** passa. ADMIN passa por cima; coordenador sem casa (servo de grupo de
   * apoio) não tem snapshot. O `houseId` do chamador vem do staff autenticado,
   * nunca do parâmetro de consulta.
   */
  private async assertHouseAccess(houseId: string, user: AuthenticatedUser): Promise<void> {
    if (user.role === Role.ADMIN) return;
    // Quem não tem perfil de staff (familiar/interno) cai no catch e leva 403 —
    // o `@Roles` do controller já barra antes, isto é a segunda tranca.
    const staff = await this.staff.findByUserId(user.userId).catch(() => null);
    if (!staff?.houseId || staff.houseId !== houseId) {
      throw new ForbiddenException('Sem acesso ao pacote offline desta casa');
    }
  }

  /**
   * `null` = sincronização completa. Sem `since`, ou com `since` mais velho que
   * `SNAPSHOT_MAX_DELTA_AGE_DAYS`, o delta não é confiável (consentimento é
   * append-only, anexo não tem `deleted_at`): o cliente recebe tudo e substitui
   * o store.
   */
  private resolveSince(raw?: string): Date | null {
    if (!raw) return null;
    const since = new Date(raw);
    if (Number.isNaN(since.getTime())) return null;
    if (since.getTime() < Date.now() - SNAPSHOT_MAX_DELTA_AGE_DAYS * DAY_MS) return null;
    return since;
  }

  private async collectDeleted(
    houseId: string,
    presentIds: string[],
    since: Date,
  ): Promise<HouseSnapshot['deleted']> {
    const [residents, followUps, receivables] = await Promise.all([
      this.residents.findDepartedIdsSince(houseId, since),
      this.followUps.findDeletedIdsSince(presentIds, since),
      this.receivables.findDeletedIdsSince(presentIds, since),
    ]);
    return { residents, followUps, receivables };
  }
}

function emptyDeleted(): HouseSnapshot['deleted'] {
  return { residents: [], followUps: [], receivables: [] };
}
