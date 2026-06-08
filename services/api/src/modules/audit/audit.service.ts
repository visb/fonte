import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface AuditEntry {
  userId?: string | null;
  role?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  httpMethod?: string | null;
  path?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  // Best-effort: uma falha de auditoria nunca deve quebrar a requisição de negócio.
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.insert({
        userId: entry.userId ?? null,
        role: entry.role ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        httpMethod: entry.httpMethod ?? null,
        path: entry.path ?? null,
        ipAddress: entry.ipAddress ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar audit log (${entry.action}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // Consulta de trilha por alvo (ex. histórico de acessos a um interno).
  findByTarget(targetType: string, targetId: string): Promise<AuditLog[]> {
    return this.repo.find({
      where: { targetType, targetId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}
