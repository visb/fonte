import {
  FAMILY_INVESTMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  type FamilyInvestment,
  type PaymentMethod,
} from '@fonte/types';
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
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';
import { amountInWords } from './amount-in-words';
import { formatReceiptNumber, referenceMonthOf } from './associate-contribution-receipt.resolver';

export interface ResidentContributionReceiptInput {
  receivable: ResidentReceivable;
  resident: Resident;
  /** Familiar responsável (decisão 9); `null` quando o filho não tem nenhum. */
  responsible: Relative | null;
  /** Nome da casa do filho; vazio para filho sem casa (ARCHIVED). */
  houseName: string;
  /** Número JÁ alocado em `issued_receipts` (a alocação é do service). */
  number: number;
  signer: DocumentSigner | null;
}

/**
 * Story 193 — segundo resolver de recibo: contribuição mensal do ACOLHIDO.
 *
 * Irmão do `AssociateContributionReceiptResolver` e, como ele, sem banco: tudo
 * chega pronto do `ReceiptService`, que valida o sujeito (parcela existente e
 * PAGA), resolve o escopo do familiar e aloca o número. Nenhum helper novo —
 * `formatReceiptNumber`, `referenceMonthOf`, `formatBRL`, `formatCpf`,
 * `formatDate`, `formatDateLong`, `amountInWords` e `buildSignatureBlock` são os
 * mesmos da 178.
 *
 * Três diferenças de DOMÍNIO em relação ao recibo do associado, e é por elas que
 * este arquivo existe em vez de um `if` lá:
 *  1. quem paga não é quem consta na parcela — a parcela é do filho, o pagador é
 *     o familiar responsável (`{{payerName}}` ≠ `{{residentName}}`, decisão 1);
 *  2. o valor impresso é o que a família PAGOU (`paidAmount ?? amount`), que
 *     diverge do plano por desenho (decisão 6);
 *  3. a competência tem coluna própria (`reference_month`) e não é derivada do
 *     vencimento (decisão 7) — em dezembro/janeiro os dois discordam.
 *
 * Sem `{{netAmount}}`/`{{feeAmount}}`: não há gateway no carnê do filho, e
 * imprimir `R$ 0,00` de taxa seria mentira formatada. Contribuição em produtos
 * (story 183) fica fora: o recibo é do dinheiro (decisão 2).
 */
export class ResidentContributionReceiptResolver implements DocumentVariableResolver {
  constructor(private readonly input: ResidentContributionReceiptInput) {}

  async resolve(): Promise<DocumentVariables> {
    const { receivable, resident, responsible, houseName, number, signer } = this.input;
    // Decisão 6 — o que a família pagou de fato, não o que o plano dizia.
    const amount = receivable.paidAmount ?? receivable.amount;
    // Decisão 9 — recibo de dinheiro JÁ recebido não pode falhar por cadastro
    // incompleto: sem responsável, o pagador é o próprio filho e o CPF fica
    // vazio (e não "não informado", que num recibo soa como recusa).
    const payerName = responsible?.name ?? resident.name ?? '';
    // `Relative` ainda não tem CPF no schema; o cast é o mesmo escape hatch do
    // recibo do associado (178) — quando a coluna existir, isto já a imprime.
    const payerCpf = responsible
      ? formatCpf((responsible as { cpf?: string | null }).cpf ?? null)
      : '';
    const plan: FamilyInvestment | null =
      receivable.paidFamilyInvestment ?? receivable.familyInvestment ?? null;
    const paymentMethod: PaymentMethod | null = receivable.paymentMethod ?? null;

    return {
      text: {
        receiptNumber: formatReceiptNumber(number),
        payerName,
        payerCpf,
        payerRelationship: responsible?.relationship ?? '',
        residentName: resident.name ?? '',
        residentCpf: formatCpf(resident.cpf ?? null),
        houseName,
        amount: formatBRL(amount),
        amountInWords: amountInWords(amount),
        // Decisão 7 — competência da COLUNA, não do vencimento.
        referenceMonth: referenceMonthOf(receivable.referenceMonth),
        paymentDate: formatDate(receivable.paidAt),
        dueDate: formatDate(receivable.dueDate),
        paymentMethod: paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] : '',
        contributionPlan: plan ? FAMILY_INVESTMENT_LABELS[plan] : '',
        // Data de EMISSÃO (hoje), mesmos helpers do recibo do associado.
        date: formatDate(new Date()),
        dateLong: formatDateLong(new Date()),
      },
      blocks: {
        '{{signature}}': (align) => buildSignatureBlock(signer, align),
      },
    };
  }
}
