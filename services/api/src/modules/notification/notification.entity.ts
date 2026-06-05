import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType, Role } from '@fonte/types';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Alvo direto a um usuário específico (null = usa role/house abaixo).
  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string | null;

  // Alvo por papel (ex.: ADMIN). null = qualquer papel.
  @Column({
    name: 'recipient_role',
    type: 'enum',
    enum: Role,
    enumName: 'users_role_enum',
    nullable: true,
  })
  recipientRole: Role | null;

  // Escopo por casa (notificações do ops escopadas à casa). null = todas.
  @Column({ name: 'house_id', type: 'uuid', nullable: true })
  houseId: string | null;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type: NotificationType;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  // Deep-link in-app. Pode divergir por app (web: /residents/:id, ops: rota mobile).
  @Column({ type: 'varchar', nullable: true })
  link: string | null;

  // Metadados livres (entityId, etc.).
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
