import { useRef } from 'react';
import { Download, FileText, Loader2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUploadSignedDocument } from '../../hooks/useResidents';
import { slugify } from '../../lib/documentFields';
import type { DocumentTemplate, ResidentDocument } from '@fonte/api-client';

interface Props {
  template: DocumentTemplate;
  residentId: string;
  signedDoc: ResidentDocument | null;
  residentName: string;
  onGenerate: (template: DocumentTemplate) => void;
  generating: boolean;
  /** Story 152 — seleção para o PDF combinado de impressão. */
  selected: boolean;
  onToggleSelect: (templateId: string) => void;
}

export function DocumentCard({
  template, residentId, signedDoc, residentName, onGenerate, generating, selected, onToggleSelect,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadSignedDocument(residentId);

  const pdfFilename = `${slugify(`${residentName} ${template.name}`)}.pdf`;
  const wasSigned = signedDoc?.signed ?? false;
  const withinWindow = signedDoc?.withinWindow ?? false;
  const signedAt = signedDoc?.signedAt
    ? new Date(signedDoc.signedAt).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
        checked={selected}
        onChange={() => onToggleSelect(template.id)}
        aria-label={`Selecionar ${template.name}`}
      />
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <FileText size={18} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{template.name}</p>
        <p className="text-xs text-muted-foreground truncate">{pdfFilename}</p>
        <div className="mt-0.5">
          {wasSigned ? (
            <Badge variant="outline" className="text-xs text-green-600 border-green-200">Assinado</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Pendente assinatura</Badge>
          )}
          {signedAt && <p className="text-xs text-muted-foreground mt-0.5">{signedAt}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" disabled={generating} onClick={() => onGenerate(template)}>
          {generating
            ? <Loader2 size={14} className="animate-spin mr-1.5" />
            : <Download size={14} className="mr-1.5" />}
          <span className="hidden sm:inline">Baixar PDF</span>
        </Button>
        {(!wasSigned || withinWindow) && (
          <Button
            variant="ghost"
            size="sm"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            title={wasSigned ? 'Substituir documento assinado' : 'Enviar documento assinado'}
          >
            {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span className="ml-1.5 hidden sm:inline">{wasSigned ? 'Substituir' : 'Enviar assinado'}</span>
          </Button>
        )}
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadMutation.mutate({ templateId: template.id, file });
          e.target.value = '';
        }} />
      </div>
    </div>
  );
}
