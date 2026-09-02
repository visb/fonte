import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import { DocumentTemplateModule } from '../document-template/document-template.module';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';
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
    TypeOrmModule.forFeature([
      IssuedReceipt,
      AssociateCharge,
      Associate,
      // Story 193 — sujeito e pessoas do recibo do acolhido. Só leitura: o
      // recibo não escreve no carnê nem no cadastro.
      ResidentReceivable,
      Resident,
      Relative,
    ]),
    DocumentTemplateModule,
  ],
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}
