import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityComment as ActivityCommentDto, Role } from '@fonte/types';
import { ActivityComment } from './activity-comment.entity';
import { ActivityService, ActivityUser } from './activity.service';
import { CreateActivityCommentDto } from './dto/create-activity-comment.dto';

@Injectable()
export class ActivityCommentService {
  constructor(
    @InjectRepository(ActivityComment)
    private repo: Repository<ActivityComment>,
    private activityService: ActivityService,
  ) {}

  private isAdmin(user: ActivityUser): boolean {
    return user.role === Role.ADMIN;
  }

  /** Lista os comentários da atividade (ordem cronológica). Valida visibilidade. */
  async findAll(
    activityId: string,
    user: ActivityUser,
  ): Promise<ActivityCommentDto[]> {
    await this.activityService.loadVisibleOrFail(activityId, user);

    const comments = await this.repo.find({
      where: { activityId },
      order: { createdAt: 'ASC' },
    });

    const authors = await this.activityService.resolveStaffRefs(
      comments.map((c) => c.createdByUserId),
    );

    return comments.map((c) =>
      this.toView(c, authors.get(c.createdByUserId) ?? null),
    );
  }

  /** Cria um comentário. Valida visibilidade; autor = usuário autenticado. */
  async create(
    activityId: string,
    dto: CreateActivityCommentDto,
    user: ActivityUser,
  ): Promise<ActivityCommentDto> {
    await this.activityService.loadVisibleOrFail(activityId, user);

    const comment = this.repo.create({
      activityId,
      body: dto.body,
      createdByUserId: user.userId,
    });
    const saved = await this.repo.save(comment);

    const authors = await this.activityService.resolveStaffRefs([user.userId]);
    return this.toView(saved, authors.get(user.userId) ?? null);
  }

  /** Soft delete; somente o autor ou ADMIN. Valida visibilidade da atividade. */
  async remove(
    activityId: string,
    commentId: string,
    user: ActivityUser,
  ): Promise<void> {
    await this.activityService.loadVisibleOrFail(activityId, user);

    const comment = await this.repo.findOne({
      where: { id: commentId, activityId },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    this.assertCanDelete(comment, user);
    await this.repo.softRemove(comment);
  }

  private assertCanDelete(comment: ActivityComment, user: ActivityUser): void {
    if (this.isAdmin(user)) return;
    if (comment.createdByUserId !== user.userId) {
      throw new ForbiddenException('You cannot delete this comment');
    }
  }

  private toView(
    c: ActivityComment,
    author: { id: string; name: string; userId: string } | null,
  ): ActivityCommentDto {
    return {
      id: c.id,
      activityId: c.activityId,
      body: c.body,
      author,
      createdByUserId: c.createdByUserId,
      createdAt:
        c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    };
  }
}
