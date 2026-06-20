import { Module } from '@nestjs/common';
import { MAIL_SENDER } from './mail.types';
import { ResendMailService } from './mail.service';

/**
 * Módulo de e-mail compartilhado (story 70). Expõe `MAIL_SENDER` (interface
 * `MailSender`) para qualquer módulo enviar e-mail transacional best-effort —
 * hoje, o link de pagamento da inscrição em evento pago.
 */
@Module({
  providers: [{ provide: MAIL_SENDER, useClass: ResendMailService }],
  exports: [MAIL_SENDER],
})
export class MailModule {}
