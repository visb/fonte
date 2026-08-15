import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import { DocumentTemplateModule } from '../document-template/document-template.module';
import { IssuedReceipt } from './issued-receipt.entity';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';

/**
 * Story 178 — recibos. Módulo próprio (e não um canto do AssociateModule)
 * porque o sujeito do recibo é polimórfico: contribuição hoje, venda de pizza e
 * de pão depois, que não têm associado nem cobrança.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([IssuedReceipt, AssociateCharge, Associate]),
    DocumentTemplateModule,
  ],
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}
