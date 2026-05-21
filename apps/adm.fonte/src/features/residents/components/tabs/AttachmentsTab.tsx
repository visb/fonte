import { useRef, useState } from 'react';
import {
  ChevronDown, Download, ExternalLink, FileText, Loader2, Paperclip, Trash2, Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useResidentDocuments, useResidentAttachments, useAddAttachment,
  useDeleteAttachment, useUploadSignedDocument,
} from '../../hooks/useResidents';
import { useDocumentTemplates } from '@/features/settings/hooks/useDocumentTemplates';
import type { DocumentTemplate, ResidentDocument, ResidentAttachment } from '@fonte/api-client';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .split('')
    .filter((c) => c.charCodeAt(0) < 0x0300 || c.charCodeAt(0) > 0x036f)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function GenerateDocumentMenu({ templates, residentId, residentName }: {
  templates: DocumentTemplate[];
  residentId: string;
  residentName: string;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadPdf = async (template: DocumentTemplate) => {
    setDownloading(template.id);
    try {
      const blob = await api.residents.downloadDocumentPdf(residentId, template.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(`${residentName} ${template.name}`)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={downloading !== null}>
          {downloading !== null ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <FileText size={14} className="mr-1.5" />}
          Gerar documento
          <ChevronDown size={14} className="ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => downloadPdf(t)}>{t.name}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AttachmentUploadButton({ residentId }: { residentId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mutation = useAddAttachment(residentId);

  return (
    <>
      <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => fileInputRef.current?.click()}>
        {mutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
        Adicionar anexo
      </Button>
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) mutation.mutate(file);
        e.target.value = '';
      }} />
    </>
  );
}

function AttachmentRow({ attachment }: { attachment: ResidentAttachment }) {
  const deleteMutation = useDeleteAttachment(attachment.residentId);
  const date = new Date(attachment.createdAt).toLocaleDateString('pt-BR');

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Paperclip size={16} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.filename}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => window.open(api.photoUrl(attachment.fileUrl)!, '_blank', 'noreferrer')}>
          <ExternalLink size={14} className="mr-1.5" />
          Abrir
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(attachment.id)}>
          {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </Button>
      </div>
    </div>
  );
}

function DocumentCard({ templateId, templateName, residentId, signedDoc, residentName }: {
  templateId: string;
  templateName: string;
  residentId: string;
  signedDoc: ResidentDocument | null;
  residentName: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const uploadMutation = useUploadSignedDocument(residentId);

  const pdfFilename = `${slugify(`${residentName} ${templateName}`)}.pdf`;

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await api.residents.downloadDocumentPdf(residentId, templateId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const wasSigned = signedDoc?.signed ?? false;
  const withinWindow = signedDoc?.withinWindow ?? false;
  const signedAt = signedDoc?.signedAt
    ? new Date(signedDoc.signedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <FileText size={18} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{templateName}</p>
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
        <Button variant="outline" size="sm" disabled={downloading} onClick={downloadPdf}>
          {downloading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Download size={14} className="mr-1.5" />}
          <span className="hidden sm:inline">Baixar PDF</span>
        </Button>
        {(!wasSigned || withinWindow) && (
          <Button variant="ghost" size="sm" disabled={uploadMutation.isPending} onClick={() => fileInputRef.current?.click()} title={wasSigned ? 'Substituir documento assinado' : 'Enviar documento assinado'}>
            {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span className="ml-1.5 hidden sm:inline">{wasSigned ? 'Substituir' : 'Enviar assinado'}</span>
          </Button>
        )}
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadMutation.mutate({ templateId, file });
          e.target.value = '';
        }} />
      </div>
    </div>
  );
}

interface Props {
  residentId: string;
  residentName: string;
}

export function AttachmentsTab({ residentId, residentName }: Props) {
  const { data: signedDocs = [] } = useResidentDocuments(residentId);
  const { data: attachments = [] } = useResidentAttachments(residentId);
  const { data: templates = [] } = useDocumentTemplates();

  const docByTemplate = Object.fromEntries(signedDocs.map((d) => [d.templateId, d]));
  const requiredTemplates = templates.filter((t) => t.isRequired);
  const optionalTemplates = templates.filter((t) => !t.isRequired);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Documentos de acolhimento
          </h3>
          {optionalTemplates.length > 0 && (
            <GenerateDocumentMenu templates={optionalTemplates} residentId={residentId} residentName={residentName} />
          )}
        </div>

        {requiredTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhum template marcado como obrigatório no acolhimento.</p>
        ) : (
          requiredTemplates.map((template) => (
            <DocumentCard
              key={template.id}
              templateId={template.id}
              templateName={template.name}
              residentId={residentId}
              residentName={residentName}
              signedDoc={docByTemplate[template.id] ?? null}
            />
          ))
        )}
      </div>

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
          attachments.map((a) => (
            <AttachmentRow key={a.id} attachment={a} />
          ))
        )}
      </div>
    </div>
  );
}
