import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventPaymentStatus } from '@fonte/types';
import { Event } from './event.entity';

@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: Event;

  @Column({ type: 'varchar' })
  name: string;

  /** Contato livre (telefone/WhatsApp ou e-mail). Validado no DTO. */
  @Column({ type: 'varchar' })
  contact: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  /**
   * Respostas dos campos custom (story 68). Mapa fieldId → valor. `file` guarda
   * a storage key (nunca URL). Default {}.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  answers: Record<string, unknown>;

  // ── Pagamento avulso (story 69) ───────────────────────────────────────────────

  /** Token p/ a página pública de pagamento. Gerado só p/ inscrição paga. */
  @Column({ name: 'payment_token', type: 'varchar', nullable: true })
  paymentToken: string | null;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    default: EventPaymentStatus.NONE,
  })
  paymentStatus: EventPaymentStatus;

  /** Valor gross-up cobrado em centavos (snapshot no momento da inscrição). */
  @Column({ name: 'amount_cents', type: 'integer', nullable: true })
  amountCents: number | null;

  /** Id genérico da order no gateway (story 41/69). */
  @Column({ name: 'gateway_order_id', type: 'varchar', nullable: true })
  gatewayOrderId: string | null;

  /** Id genérico da charge no gateway (idempotência do webhook). */
  @Column({ name: 'gateway_charge_id', type: 'varchar', nullable: true })
  gatewayChargeId: string | null;

  /** Método escolhido (`credit_card` | `pix`). */
  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
