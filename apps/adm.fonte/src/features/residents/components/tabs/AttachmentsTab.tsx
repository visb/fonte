import { TemplateKind, isTemplateAvailableForStatus } from '@fonte/types';
import { Badge } from '@/components/ui/badge';
import {
  useResidentById, useResidentDocuments, useResidentAttachments,
} from '../../hooks/useResidents';
import { useDocumentGeneration } from '../../hooks/useDocumentGeneration';
import { useDocumentTemplates } from '@/features/settings/hooks/useDocumentTemplates';
import { useStaffMe } from '@/features/staff/hooks/useStaff';
import { SignatureDialog } from '@/features/auth/components/SignatureDialog';
import { MissingFieldsDialog } from '../MissingFieldsDialog';
import { AttachmentRow } from './AttachmentRow';
import { AttachmentUploadButton } from './AttachmentUploadButton';
import { CombinedPdfBar } from './CombinedPdfBar';
import { DocumentCardList } from './DocumentCardList';
import { GenerateDocumentMenu } from './GenerateDocumentMenu';
import { GenerateErrorAlert } from './GenerateErrorAlert';

interface Props {
  residentId: string;
  residentName: string;
}

export function AttachmentsTab({ residentId, residentName }: Props) {
  const { data: resident } = useResidentById(residentId);
  const { data: signedDocs = [] } = useResidentDocuments(residentId);
  const { data: attachments = [] } = useResidentAttachments(residentId);
  const { data: templates = [] } = useDocumentTemplates();
  const { data: me } = useStaffMe();

  const gen = useDocumentGeneration({
    residentId,
    residentName,
    resident,
    signatureUrl: me?.signatureUrl ?? null,
  });

  const docByTemplate = Object.fromEntries(signedDocs.map((d) => [d.templateId, d]));
  // Story 160 — o que não vale para o status do filho não entra em nenhum grupo:
  // some do card, do menu "Gerar documento" e da seleção do PDF combinado, então
  // a tela nunca monta uma requisição que o backend vai recusar. É o MESMO
  // predicado do backend, inclusive com o filho ainda carregando (`resident`
  // undefined): sem status nenhum template restrito passa — só os `ALL`, que são
  // exatamente os que o backend aceitaria de qualquer forma.
  // Story 178 — cinto e suspensório: o backend já devolve só `kind = RESIDENT`
  // (default do `findAll`), mas um recibo que chegasse aqui por cache velho ou
  // por uma regressão do filtro não pode virar card de documento do filho.
  const availableTemplates = templates.filter(
    (t) =>
      t.kind !== TemplateKind.RECEIPT &&
      isTemplateAvailableForStatus(t.availableFor, resident?.status),
  );
  const requiredTemplates = availableTemplates.filter((t) => t.isRequired);
  const optionalTemplates = availableTemplates.filter((t) => !t.isRequired);
  const admissionSignTemplates = availableTemplates.filter((t) => t.signAtAdmission);
  // Story 152 — ordem do PDF combinado = ordem da tela (obrigatórios e depois os
  // de assinatura no acolhimento). Um template que esteja nos dois grupos entra
  // uma única vez no arquivo final.
  const selectableTemplates = [
    ...requiredTemplates,
    ...admissionSignTemplates.filter((t) => !t.isRequired),
  ];
  const selectedTemplates = selectableTemplates.filter((t) => gen.selectedIds.has(t.id));
  // Story 161 — o "marcar todos" da barra opera sobre esta MESMA lista: já
  // deduplicada (story 152) e já filtrada pelo status do filho (story 160).
  // Templates opcionais e "outros anexos" ficam de fora — não têm card com
  // checkbox.
  const selectableCount = selectableTemplates.length;
  const selectedCount = selectedTemplates.length;

  const cardListProps = {
    residentId,
    residentName,
    docByTemplate,
    generatingId: gen.generatingId,
    onGenerate: gen.requestSingle,
    selectedIds: gen.selectedIds,
    onToggleSelect: gen.toggleSelected,
  };

  return (
    <div className="space-y-6">
      {gen.error && <GenerateErrorAlert message={gen.error} onDismiss={gen.dismissError} />}

      <CombinedPdfBar
        count={selectedCount}
        total={selectableCount}
        allSelected={selectableCount > 0 && selectedCount === selectableCount}
        someSelected={selectedCount > 0}
        generating={gen.generatingCombined}
        onGenerate={() => gen.requestCombined(selectedTemplates)}
        onToggleAll={() => gen.toggleAll(selectableTemplates.map((t) => t.id))}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Documentos de acolhimento
          </h3>
          {optionalTemplates.length > 0 && (
            <GenerateDocumentMenu
              templates={optionalTemplates}
              onGenerate={gen.requestSingle}
              generatingId={gen.generatingId}
            />
          )}
        </div>

        {requiredTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhum template marcado como obrigatório no acolhimento.</p>
        ) : (
          <DocumentCardList templates={requiredTemplates} {...cardListProps} />
        )}
      </div>

      {admissionSignTemplates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Documentos para assinatura no acolhimento
            </h3>
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">LGPD</Badge>
          </div>
          <DocumentCardList templates={admissionSignTemplates} {...cardListProps} />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Outros anexos
          </h3>
          <AttachmentUploadButton residentId={residentId} />
        </div>

        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhum anexo adicionado.</p>
        ) : (
          attachments.map((a) => <AttachmentRow key={a.id} attachment={a} />)
        )}
      </div>

      <MissingFieldsDialog
        open={gen.missingDialog !== null}
        onClose={gen.closeMissingDialog}
        missingFields={gen.missingDialog?.missingFields ?? []}
        residentId={residentId}
        onSaved={() => gen.missingDialog?.run()}
      />

      <SignatureDialog
        open={gen.signatureDialog !== null}
        onClose={gen.closeSignatureDialog}
        onSaved={() => gen.signatureDialog?.run()}
      />
    </div>
  );
}
