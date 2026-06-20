import { useState } from 'react';
import type { PixPaymentResult } from '@fonte/types';

interface Props {
  pix: PixPaymentResult;
}

/**
 * Exibe o pagamento PIX (story 70): QR code + copia-e-cola. O status é confirmado
 * pelo webhook no backend; a página faz polling até virar PAID.
 */
export function PixPayment({ pix }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!pix.qrCode) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="pix-block">
      <h2>Pague com PIX</h2>
      <p className="hint">
        Escaneie o QR code no app do seu banco ou use o código copia-e-cola.
        Assim que o pagamento for confirmado, esta página atualiza automaticamente.
      </p>

      {pix.qrCodeUrl && (
        <img src={pix.qrCodeUrl} alt="QR code do PIX" className="pix-qr" />
      )}

      {pix.qrCode && (
        <>
          <div className="field">
            <label htmlFor="pix-code">Código copia-e-cola</label>
            <textarea id="pix-code" readOnly value={pix.qrCode} rows={3} />
          </div>
          <button className="primary" type="button" onClick={copy}>
            {copied ? 'Copiado!' : 'Copiar código PIX'}
          </button>
        </>
      )}
    </div>
  );
}
