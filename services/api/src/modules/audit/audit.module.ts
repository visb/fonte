import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditQueryService } from './audit-query.service';
import { AuditController } from './audit.controller';
import { AuditContextMiddleware } from './audit-context.middleware';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';

// Global (story 199): resident/staff/house/ministry/carnê injetam o AuditService
// para gravar eventos na transação da escrita, sem cada módulo importar este.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditQueryService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  // Story 199 — contexto de auditoria em toda requisição (e captura do login).
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }
}
