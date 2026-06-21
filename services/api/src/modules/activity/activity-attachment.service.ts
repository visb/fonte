import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActivityAttachment as ActivityAttachmentDto,
  ActivityStatus,
  Role,
} from '@fonte/types';
import { ActivityAttachment } from './activity-attachment.entity';
import { Activity } from './activity.entity';
import { ActivityComment } from './activity-comment.entity';
import { ActivityService, ActivityUser } from './activity.service';
import { StorageService } from '../storage/storage.service';
import {
  attachmentTypeFromMimetype,
  isAllowedAttachmentMimetype,
} from './activity-attachment.mimetypes';

/**
 * Anexos de atividade e de comentário (story 73). Reusa a infra de storage e a
 * visibilidade por casa do `ActivityService` (`loadVisibleOrFail`). O backend é a
 * autoridade tanto para upload (allowlist de mimetype, visibilidade) quanto para
 * exclusão (regra de edição da entidade-pai).
 */
@Injectable()
export class ActivityAttachmentService {
  constructor(
    @InjectRepository(ActivityAttachment)
    private repo: Repository<ActivityAttachment>,
    @InjectRepository(ActivityComment)
    private commentRepo: Repository<ActivityComment>,
    @Inject(forwardRef(() => ActivityService))
    private activityService: ActivityService,
    private storage: StorageService,
  ) {}

  private isAdmin(user: ActivityUser): boolean {
    return user.role === Role.ADMIN;
  }

  /**
   * Anexo da própria atividade. Valida visibilidade (escopo por casa) e a
   * allowlist de mimetype, grava no storage e persiste. Autor = usuário autenticado.
   */
  async addActivityAttachment(
    activityId: string,
    file: Express.Multer.File,
    user: ActivityUser,
    durationSeconds?: number | null,
  ): Promise<ActivityAttachmentDto> {
    const activity = await this.activityService.loadVisibleOrFail(
      activityId,
      user,
    );
    return this.store(activity, null, file, user, durationSeconds);
  }

  /**
   * Anexo de um comentário. Valida visibilidade da atividade + que o comentário
   * pertence a ela, a allowlist de mimetype, grava no storage e persiste.
   */
  async addCommentAttachment(
    activityId: string,
    commentId: string,
    file: Express.Multer.File,
    user: ActivityUser,
    durationSeconds?: number | null,
  ): Promise<ActivityAttachmentDto> {
    const activity = await this.activityService.loadVisibleOrFail(
      activityId,
      user,
    );
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, activityId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.store(activity, comment, file, user, durationSeconds);
  }

  private async store(
    activity: Activity,
    comment: ActivityComment | null,
    file: Express.Multer.File,
    user: ActivityUser,
    durationSeconds?: number | null,
  ): Promise<ActivityAttachmentDto> {
    if (!file) throw new BadRequestException('File not provided');
    if (!isAllowedAttachmentMimetype(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    const fileName = this.storage.decodeOriginalName(file.originalname);
    const filename = this.storage.uniqueFilename(file.originalname);
    const fileUrl = await this.storage.upload(
      'activities',
      filename,
      file.buffer,
      file.mimetype,
    );

    const fileType = attachmentTypeFromMimetype(file.mimetype);
    const attachment = this.repo.create({
      activityId: activity.id,
      commentId: comment?.id ?? null,
      fileUrl,
      fileName,
      fileType,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      // Duração só faz sentido para áudio; ignora valores inválidos.
      durationSeconds: this.normalizeDuration(fileType, durationSeconds),
      createdByUserId: user.userId,
    });
    const saved = await this.repo.save(attachment);
    return this.toView(saved, activity, comment, user);
  }

  /**
   * Exclui um anexo (da atividade ou de comentário). Permissão pela regra da
   * entidade-pai: anexo de comentário → autor do comentário ou ADMIN; anexo de
   * atividade → ADMIN sempre, criador da atividade enquanto ela é editável (DRAFT).
   * Remove o arquivo do storage e faz soft delete.
   */
  async deleteAttachment(
    activityId: string,
    attachmentId: string,
    user: ActivityUser,
  ): Promise<void> {
    const activity = await this.activityService.loadVisibleOrFail(
      activityId,
      user,
    );
    const attachment = await this.repo.findOne({
      where: { id: attachmentId, activityId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const comment = attachment.commentId
      ? await this.commentRepo.findOne({ where: { id: attachment.commentId } })
      : null;

    if (!this.canDelete(attachment, activity, comment, user)) {
      throw new ForbiddenException('You cannot delete this attachment');
    }

    await this.storage.delete(attachment.fileUrl);
    await this.repo.softRemove(attachment);
  }

  /** Lista os anexos diretos da atividade (commentId null). */
  async listActivityAttachments(
    activity: Activity,
    user: ActivityUser,
  ): Promise<ActivityAttachmentDto[]> {
    const rows = await this.repo.find({
      where: { activityId: activity.id, commentId: null as never },
      order: { createdAt: 'ASC' },
    });
    return rows.map((a) => this.toView(a, activity, null, user));
  }

  /**
   * Lista anexos de comentários agrupados por commentId, para o comment service
   * embutir no payload sem N+1. Cada anexo carrega `canDelete` conforme a regra
   * do comentário correspondente.
   */
  async attachmentsByComment(
    activityId: string,
    comments: ActivityComment[],
    user: ActivityUser,
  ): Promise<Map<string, ActivityAttachmentDto[]>> {
    const map = new Map<string, ActivityAttachmentDto[]>();
    if (comments.length === 0) return map;
    const commentById = new Map(comments.map((c) => [c.id, c]));
    const rows = await this.repo.find({
      where: comments.map((c) => ({ commentId: c.id })),
      order: { createdAt: 'ASC' },
    });
    for (const row of rows) {
      const comment = row.commentId
        ? commentById.get(row.commentId) ?? null
        : null;
      const view = this.toView(row, null, comment, user);
      const list = map.get(view.commentId as string) ?? [];
      list.push(view);
      map.set(view.commentId as string, list);
    }
    return map;
  }

  /**
   * Regra de exclusão pela entidade-pai. Anexo de comentário: autor do comentário
   * ou ADMIN. Anexo de atividade: ADMIN sempre; criador da atividade enquanto ela
   * é editável (DRAFT, espelhando a regra de conteúdo da story 48).
   */
  private canDelete(
    attachment: ActivityAttachment,
    activity: Activity | null,
    comment: ActivityComment | null,
    user: ActivityUser,
  ): boolean {
    if (this.isAdmin(user)) return true;
    if (attachment.commentId) {
      return comment?.createdByUserId === user.userId;
    }
    if (!activity) return false;
    return (
      activity.createdByUserId === user.userId &&
      activity.status === ActivityStatus.DRAFT
    );
  }

  /**
   * Normaliza a duração recebida do cliente: só persiste para áudio, descarta
   * valores não-positivos/NaN (o backend não decodifica áudio — confia no cliente
   * apenas como metadado de exibição).
   */
  private normalizeDuration(
    fileType: ActivityAttachmentDto['fileType'],
    durationSeconds?: number | null,
  ): number | null {
    if (fileType !== 'audio') return null;
    if (durationSeconds == null) return null;
    const rounded = Math.round(durationSeconds);
    return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
  }

  private toView(
    a: ActivityAttachment,
    activity: Activity | null,
    comment: ActivityComment | null,
    user: ActivityUser,
  ): ActivityAttachmentDto {
    return {
      id: a.id,
      activityId: a.activityId,
      commentId: a.commentId ?? null,
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      fileType: a.fileType,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      durationSeconds: a.durationSeconds ?? null,
      createdByUserId: a.createdByUserId,
      createdAt:
        a.createdAt instanceof Date
          ? a.createdAt.toISOString()
          : String(a.createdAt),
      canDelete: this.canDelete(a, activity, comment, user),
    };
  }
}
