import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { extractTemplatesVars, findMissingFields, slugify } from '../lib/documentFields';
import type { MissingField } from '../components/MissingFieldsDialog';
import type { DocumentTemplate, Resident } from '@fonte/api-client';

interface Params {
  residentId: string;
  residentName: string;
  resident?: Resident;
  /** Assinatura do staff logado; ausente ⇒ gate da story 128. */
  signatureUrl?: string | null;
}

// Ação de geração já resolvida, guardada enquanto um diálogo de pré-voo está
// aberto: ao salvar no diálogo, a mesma geração é retomada.
interface PendingGeneration {
  run: () => void;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Geração de PDFs da aba de anexos: download individual (story 128), PDF
 * combinado para impressão em lote (story 152), seleção dos cards e os dois
 * gates de pré-voo (assinatura do staff e campos faltantes do filho).
 */
export function useDocumentGeneration({ residentId, residentName, resident, signatureUrl }: Params) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingCombined, setGeneratingCombined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [missingDialog, setMissingDialog] = useState<
    (PendingGeneration & { missingFields: MissingField[] }) | null
  >(null);
  const [signatureDialog, setSignatureDialog] = useState<PendingGeneration | null>(null);

  const downloadPdf = useCallback(async (template: DocumentTemplate) => {
    setGeneratingId(template.id);
    setError(null);
    try {
      const blob = await api.residents.downloadDocumentPdf(residentId, template.id);
      triggerDownload(blob, `${slugify(`${residentName} ${template.name}`)}.pdf`);
    } catch (e) {
      setError(getErrorMessage(e, `Falha ao gerar "${template.name}". Tente novamente em instantes.`));
    } finally {
      setGeneratingId(null);
    }
  }, [residentId, residentName]);

  // Story 152 — um POST só com os ids NA ORDEM DA TELA; o backend mescla os PDFs
  // já renderizados, então cada documento começa numa página nova.
  const downloadCombinedPdf = useCallback(async (templates: DocumentTemplate[]) => {
    setGeneratingCombined(true);
    setError(null);
    try {
      const blob = await api.residents.downloadCombinedDocumentsPdf(
        residentId,
        templates.map((t) => t.id),
      );
      triggerDownload(blob, `${slugify(`${residentName} documentos`)}.pdf`);
      // Story 161 — o download é o fim natural do fluxo: a seleção limpa
      // sozinha. Só no caminho de sucesso; se falhou, a seleção fica de pé para
      // o usuário tentar de novo.
      setSelectedIds(new Set());
    } catch (e) {
      setError(getErrorMessage(e, 'Falha ao gerar o PDF combinado. Tente novamente em instantes.'));
    } finally {
      setGeneratingCombined(false);
    }
  }, [residentId, residentName]);

  // Pré-voo comum ao download individual e ao combinado: assinatura do staff
  // (story 128) e campos do filho ainda vazios. Só depois de passar nos dois é
  // que a geração roda — combinado com {{signature}} cru ou campo em branco
  // seria pior que o fluxo atual.
  const requestGeneration = useCallback((templates: DocumentTemplate[], run: () => void) => {
    if (!resident) {
      run();
      return;
    }
    const vars = extractTemplatesVars(templates);
    if (vars.includes('signature') && !signatureUrl) {
      setSignatureDialog({ run });
      return;
    }
    const missingFields = findMissingFields(vars, resident);
    if (missingFields.length === 0) run();
    else setMissingDialog({ missingFields, run });
  }, [resident, signatureUrl]);

  const requestSingle = useCallback((template: DocumentTemplate) => {
    requestGeneration([template], () => void downloadPdf(template));
  }, [requestGeneration, downloadPdf]);

  const requestCombined = useCallback((templates: DocumentTemplate[]) => {
    if (!templates.length) return;
    requestGeneration(templates, () => void downloadCombinedPdf(templates));
  }, [requestGeneration, downloadCombinedPdf]);

  const toggleSelected = useCallback((templateId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(templateId)) next.add(templateId);
      return next;
    });
  }, []);

  // Story 161 — checkbox de cabeçalho da barra: com todos os `ids` já marcados
  // esvazia; caso contrário (nada ou parte marcada) marca todos.
  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const everySelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return everySelected ? new Set<string>() : new Set(ids);
    });
  }, []);

  return {
    generatingId,
    generatingCombined,
    error,
    dismissError: useCallback(() => setError(null), []),
    selectedIds,
    toggleSelected,
    toggleAll,
    requestSingle,
    requestCombined,
    missingDialog,
    closeMissingDialog: useCallback(() => setMissingDialog(null), []),
    signatureDialog,
    closeSignatureDialog: useCallback(() => setSignatureDialog(null), []),
  };
}
