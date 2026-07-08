import { FileText, RotateCcw } from 'lucide-react';
import { ReceivableStatus } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FAMILY_INVESTMENT_LABELS, FAMILY_INVESTMENT_VARIANT, PAYMENT_METHOD_LABELS } from '../constants';
import { formatDate, formatReferenceMonth, receivableBadge } from '../lib/receivables';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';
import { ProductContributionList } from './ProductContributionList';

interface Props {
  receivable: ResidentReceivable;
  canManage: boolean;
  catalog?: InventoryCatalogItem[];
  onPayClick: (r: ResidentReceivable) => void;
  onReopenClick: (r: ResidentReceivable) => void;
}

export function ReceivableRow({ receivable, canManage, catalog = [], onPayClick, onReopenClick }: Props) {
  const badge = receivableBadge(receivable);
  const isPaid = receivable.status === ReceivableStatus.PAID;
  const attachment = receivable.attachmentUrl ? api.photoUrl(receivable.attachmentUrl) : null;

  // When paid, prefer the amount/modality actually collected over the plan snapshot.
  const displayAmount = isPaid && receivable.paidAmount != null ? receivable.paidAmount : receivable.amount;
  const paidModality =
    isPaid && receivable.paidFamilyInvestment != null ? receivable.paidFamilyInvestment : null;
  const modalityDiverges = paidModality != null && paidModality !== receivable.familyInvestment;

  const productContributions = receivable.productContributions ?? [];

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{formatReferenceMonth(receivable.referenceMonth)}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {!receivable.mandatory && <Badge variant="outline">Voluntário</Badge>}
          {modalityDiverges && paidModality && (
            <Badge variant={FAMILY_INVESTMENT_VARIANT[paidModality]}>
              {FAMILY_INVESTMENT_LABELS[paidModality]}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {isPaid ? (
            <span>
              Pago em {formatDate(receivable.paidAt)}
              {receivable.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[receivable.paymentMethod]}` : ''}
            </span>
          ) : (
            <span>Vence {formatDate(receivable.dueDate)}</span>
          )}
        </div>
        {isPaid && receivable.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{receivable.notes}</p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="font-semibold">R$ {displayAmount}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {attachment && (
          <a href={attachment} target="_blank" rel="noreferrer" title="Ver comprovante">
            <Button variant="ghost" size="icon">
              <FileText size={16} />
            </Button>
          </a>
        )}
        {!isPaid && receivable.status === ReceivableStatus.PENDING && canManage && (
          <Button variant="outline" size="sm" onClick={() => onPayClick(receivable)}>
            Registrar pagamento
          </Button>
        )}
        {isPaid && canManage && (
          <Button variant="ghost" size="icon" onClick={() => onReopenClick(receivable)} title="Reabrir">
            <RotateCcw size={16} />
          </Button>
        )}
      </div>
      </div>

      <ProductContributionList contributions={productContributions} catalog={catalog} />
    </div>
  );
}
