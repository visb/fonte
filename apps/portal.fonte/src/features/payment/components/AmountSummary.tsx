import { formatBRL, previewGrossUp } from '@/lib/money';

interface AmountSummaryProps {
  contributionAmount: number;
}

/**
 * Mostra de forma transparente o valor que será COBRADO no cartão (contribuição +
 * taxa do gateway via gross-up) e deixa claro que a cobrança é MENSAL RECORRENTE.
 * O valor oficial é confirmado pelo backend ([[38]]); aqui é preview.
 */
export function AmountSummary({ contributionAmount }: AmountSummaryProps) {
  const { net, fee, gross } = previewGrossUp(contributionAmount);

  return (
    <div className="summary">
      <div className="summary-row">
        <span>Sua contribuição (a Fonte recebe)</span>
        <span>{formatBRL(net)}</span>
      </div>
      <div className="summary-row">
        <span>Taxa do cartão</span>
        <span>{formatBRL(fee)}</span>
      </div>
      <div className="summary-row total">
        <span>Cobrado no cartão</span>
        <span>{formatBRL(gross)}</span>
      </div>
      <p className="summary-note">
        Cobrança <strong>mensal recorrente</strong>. O valor é debitado
        automaticamente todo mês; você pode cancelar quando quiser.
      </p>
    </div>
  );
}
