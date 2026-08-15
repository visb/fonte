import {
  buildSignatureBlock,
  formatBRL,
  formatCpf,
  formatDate,
  formatDateLong,
  type DocumentSigner,
  type DocumentVariableResolver,
  type DocumentVariables,
} from '../document-template/document-variables';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import { amountInWords } from './amount-in-words';

/** Número do recibo com zero-padding a 6 (`123` → `000123`). */
export function formatReceiptNumber(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(6, '0');
}

/**
 * Competência da contribuição a partir do vencimento: `2026-08-10` →
 * `agosto/2026`. Lê os componentes da string `date` do Postgres em vez de
 * construir um `Date` local, que em fuso negativo puxaria o dia 1º para o mês
 * anterior e imprimiria a competência errada.
 */
export function referenceMonthOf(dueDate: string | Date | null): string {
  if (!dueDate) return 'não informado';
  const iso = typeof dueDate === 'string' ? dueDate : dueDate.toISOString().slice(0, 10);
  const [year, month] = iso.slice(0, 10).split('-');
  const monthIndex = Number(month) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return 'não informado';
  }
  const name = new Date(Date.UTC(2000, monthIndex, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${name}/${year}`;
}

export interface AssociateContributionReceiptInput {
  charge: AssociateCharge;
  associate: Associate;
  /** Número JÁ alocado em `issued_receipts` (a alocação é do service). */
  number: number;
  signer: DocumentSigner | null;
}

/**
 * Story 178 — primeiro resolver de recibo: contribuição mensal do associado.
 *
 * Não consulta banco: tudo chega pronto do `ReceiptService`, que é quem valida o
 * sujeito (cobrança existente e PAGA) e aloca o número. Por isso `paidAt` nunca
 * é nulo aqui — quando é, a requisição já morreu no passo anterior com 400.
 *
 * Pizza e pão custam um arquivo como este, sem migration nem contrato novo.
 */
export class AssociateContributionReceiptResolver implements DocumentVariableResolver {
  constructor(private readonly input: AssociateContributionReceiptInput) {}

  async resolve(): Promise<DocumentVariables> {
    const { charge, associate, number, signer } = this.input;
    return {
      text: {
        receiptNumber: formatReceiptNumber(number),
        payerName: associate.name ?? '',
        // `formatCpf` compartilhado com o documento do filho: um CPF é impresso
        // do mesmo jeito em toda a casa. O associado ainda não tem CPF próprio
        // no schema — quando tiver, é só preencher aqui.
        payerCpf: formatCpf((associate as { cpf?: string | null }).cpf ?? null),
        // O que o associado PAGOU (bruto). `netAmount`/`feeAmount` ficam
        // disponíveis para o template que queira discriminar a taxa do gateway.
        amount: formatBRL(charge.grossAmount),
        netAmount: formatBRL(charge.netAmount),
        feeAmount: formatBRL(charge.feeAmount),
        amountInWords: amountInWords(charge.grossAmount),
        referenceMonth: referenceMonthOf(charge.dueDate),
        paymentDate: formatDate(charge.paidAt),
        dueDate: formatDate(charge.dueDate),
        // Data de EMISSÃO (hoje), mesmos helpers do documento do filho.
        date: formatDate(new Date()),
        dateLong: formatDateLong(new Date()),
      },
      blocks: {
        // Recibo também é assinado por quem o emitiu — mesmo bloco de sempre.
        '{{signature}}': (align) => buildSignatureBlock(signer, align),
      },
    };
  }
}
