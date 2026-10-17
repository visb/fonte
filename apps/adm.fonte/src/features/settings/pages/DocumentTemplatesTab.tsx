import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { RECEIPT_TYPE_LABELS, ReceiptType, TemplateKind } from '@fonte/types';
import { NEW_RECEIPT_PARAM } from '@/components/shared/ReceiptErrorAlert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DocumentTemplate } from '@fonte/api-client';
import { useDocumentTemplates, useDeleteDocumentTemplate } from '../hooks/useDocumentTemplates';
import { TemplateEditor } from '../components/TemplateEditor';
import { TemplateGroupSection } from '../components/TemplateGroupSection';
import { CreateTemplateDialog } from '../components/CreateTemplateDialog';
import { TEMPLATE_KIND_SECTIONS } from '../constants';

/**
 * Story 178 — a MESMA aba com dois grupos (documentos do acolhido e recibos).
 * Aba nova só duplicaria chrome: o editor é o mesmo componente; o que muda entre
 * os grupos é o dicionário de variáveis e os controles que fazem sentido.
 */
export function DocumentTemplatesTab() {
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [createKind, setCreateKind] = useState<TemplateKind | null>(null);
  const [initialReceiptType, setInitialReceiptType] = useState<ReceiptType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Story 212, decisão 8 — `?newReceipt=<tipo>` (atalho do erro do gerador)
  // abre o dialog de novo recibo com o tipo; tipo inválido abre sem seleção. O
  // param é consumido para não reabrir o dialog num reload.
  const newReceiptParam = searchParams.get(NEW_RECEIPT_PARAM);
  useEffect(() => {
    if (newReceiptParam === null) return;
    const valid = (Object.values(ReceiptType) as string[]).includes(newReceiptParam);
    setInitialReceiptType(valid ? (newReceiptParam as ReceiptType) : null);
    setCreateKind(TemplateKind.RECEIPT);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(NEW_RECEIPT_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [newReceiptParam, setSearchParams]);

  const closeCreate = () => {
    setCreateKind(null);
    setInitialReceiptType(null);
  };

  // Duas queries com query keys distintas (o backend filtra por kind): o recibo
  // nunca entra na lista que a aba de Anexos do acolhido consome.
  const { data: residentTemplates = [] } = useDocumentTemplates(TemplateKind.RESIDENT);
  const { data: receiptTemplates = [] } = useDocumentTemplates(TemplateKind.RECEIPT);
  const deleteMutation = useDeleteDocumentTemplate();

  const templatesByKind: Record<TemplateKind, DocumentTemplate[]> = {
    [TemplateKind.RESIDENT]: residentTemplates,
    [TemplateKind.RECEIPT]: receiptTemplates,
  };

  const takenReceiptTypes = receiptTemplates
    .map((t) => t.receiptType)
    .filter((t): t is ReceiptType => !!t);

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            <ChevronLeft size={16} className="mr-1" />
            Voltar
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-sm truncate">{editing.name}</span>
            {editing.kind === TemplateKind.RECEIPT && (
              <Badge variant="secondary" className="text-xs shrink-0">Recibo</Badge>
            )}
            {/* Story 212, decisão 1 — o tipo que o gerador procura, à vista. */}
            {editing.kind === TemplateKind.RECEIPT && editing.receiptType && (
              <Badge variant="outline" className="text-xs shrink-0" data-testid="editing-receipt-type">
                {RECEIPT_TYPE_LABELS[editing.receiptType]}
              </Badge>
            )}
            {editing.isRequired && (
              <Badge variant="secondary" className="text-xs shrink-0">Acolhimento</Badge>
            )}
          </div>
        </div>
        <TemplateEditor
          key={editing.id}
          template={editing}
          onSaved={(updated) => setEditing(updated)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {TEMPLATE_KIND_SECTIONS.map((section) => (
        <TemplateGroupSection
          key={section.kind}
          title={section.title}
          hint={section.hint}
          emptyTitle={section.emptyTitle}
          createLabel={section.createLabel}
          templates={templatesByKind[section.kind]}
          onCreate={() => setCreateKind(section.kind)}
          onSelect={setEditing}
          onDelete={setDeleteTarget}
        />
      ))}

      <CreateTemplateDialog
        open={createKind !== null}
        onClose={closeCreate}
        kind={createKind ?? TemplateKind.RESIDENT}
        takenReceiptTypes={takenReceiptTypes}
        initialReceiptType={initialReceiptType}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
