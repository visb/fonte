import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// LGPD art. 37/46 — registro de operações sobre dados pessoais (quem, o quê,
// quando, de onde). Tabela append-only: nunca recebe update/delete.
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Usuário autenticado que disparou a operação (null se anônimo/sistema).
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

  @Column({ type: 'varchar', nullable: true })
  path: string | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
