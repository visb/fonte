import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AuditChange } from '@fonte/types';

// LGPD art. 37/46 — registro de operações sobre dados pessoais (quem, o quê,
// quando, de onde). Tabela append-only pelas APIs: nenhuma rota edita/apaga
// evento. Única escrita posterior: a anonimização do titular zera os valores
// dos diffs dele (AuditService.redactForResident), por exigência da LGPD.
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Usuário autenticado que disparou a operação (null se anônimo/sistema ou
  // tentativa de login malsucedida).
  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', nullable: true })
  role: string | null;

  // Ação semântica, ex. 'resident.read', 'resident.update'.
  @Index()
  @Column({ type: 'varchar' })
  action: string;

  // Tipo e id do recurso afetado, ex. 'resident' + uuid.
  @Column({ name: 'target_type', type: 'varchar', nullable: true })
  targetType: string | null;

  @Index()
  @Column({ name: 'target_id', type: 'varchar', nullable: true })
  targetId: string | null;

  @Column({ name: 'http_method', type: 'varchar', nullable: true })
  httpMethod: string | null;

  // Sempre SEM query string (story 199).
  @Column({ type: 'varchar', nullable: true })
  path: string | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  // ── Story 199 — todos opcionais; eventos legados ficam com NULL ──────────

  @Column({ type: 'varchar', nullable: true })
  outcome: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ name: 'house_id', type: 'uuid', nullable: true })
  houseId: string | null;

  @Column({ name: 'previous_house_id', type: 'uuid', nullable: true })
  previousHouseId: string | null;

  @Column({ name: 'parent_type', type: 'varchar', nullable: true })
  parentType: string | null;

  @Column({ name: 'parent_id', type: 'varchar', nullable: true })
  parentId: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', nullable: true })
  correlationId: string | null;

  @Column({ name: 'changed_fields', type: 'text', array: true, nullable: true })
  changedFields: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: AuditChange[] | null;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
