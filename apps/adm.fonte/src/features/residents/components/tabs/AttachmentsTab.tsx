import { useCallback, useRef, useState } from 'react';
import {
  ChevronDown, Download, ExternalLink, FileText, Loader2, Paperclip, Trash2, Upload,
} from 'lucide-react';
import { MaritalStatus } from '@fonte/types';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useResidentById, useResidentDocuments, useResidentAttachments,
  useAddAttachment, useDeleteAttachment, useUploadSignedDocument,
} from '../../hooks/useResidents';
import { useDocumentTemplates } from '@/features/settings/hooks/useDocumentTemplates';
import { MissingFieldsDialog } from '../MissingFieldsDialog';
import type { MissingField } from '../MissingFieldsDialog';
import type { DocumentTemplate, Resident, ResidentDocument, ResidentAttachment, UpdateResidentInput } from '@fonte/api-client';

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

const ALWAYS_AVAILABLE = new Set(['name', 'house', 'entryDate', 'date', 'dateLong']);

interface VarMapping {
  residentField: keyof UpdateResidentInput;
  label: string;
  inputType: 'text' | 'date' | 'select';
  options?: { value: string; label: string }[];
  isEmpty: (r: Resident) => boolean;
}

const VAR_TO_FIELD: Record<string, VarMapping> = {
  cpf:          { residentField: 'cpf',           label: 'CPF',                inputType: 'text',   isEmpty: (r) => !r.cpf },
  rg:           { residentField: 'rg',            label: 'RG',                 inputType: 'text',   isEmpty: (r) => !r.rg },
  nationality:  { residentField: 'nationality',   label: 'Nacionalidade',      inputType: 'text',   isEmpty: (r) => !r.nationality },
  city:         { residentField: 'city',          label: 'Cidade',             inputType: 'text',   isEmpty: (r) => !r.city },
  state:        { residentField: 'state',         label: 'UF',                 inputType: 'text',   isEmpty: (r) => !r.state },
  birthDate:    { residentField: 'birthDate',     label: 'Data de nascimento', inputType: 'date',   isEmpty: (r) => !r.birthDate },
  age:          { residentField: 'birthDate',     label: 'Data de nascimento', inputType: 'date',   isEmpty: (r) => !r.birthDate },
  maritalStatus: {
    residentField: 'maritalStatus',
    label: 'Estado civil',
    inputType: 'select',
    options: [
      { value: MaritalStatus.SINGLE,   label: 'Solteiro(a)' },
      { value: MaritalStatus.MARRIED,  label: 'Casado(a)' },
      { value: MaritalStatus.DIVORCED, label: 'Divorciado(a)' },
    ],
    isEmpty: (r) => !r.maritalStatus,
  },
  address: { residentField: 'address',      label: 'Endereço', inputType: 'text', isEmpty: (r) => !r.address },
  phone:   { residentField: 'contactPhone', label: 'Telefone', inputType: 'text', isEmpty: (r) => !r.contactPhone },
};

function extractTemplateVars(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

function findMissingFields(vars: string[], resident: Resident): MissingField[] {
  const seen = new Set<string>();
  const result: MissingField[] = [];
  for (const varName of vars) {
    if (ALWAYS_AVAILABLE.has(varName)) continue;
    const mapping = VAR_TO_FIELD[varName];
    if (!mapping) continue;
    const fieldKey = mapping.residentField as string;
    if (seen.has(fieldKey)) continue;
    if (!mapping.isEmpty(resident)) continue;
    seen.add(fieldKey);
    result.push({
      residentField: mapping.residentField,
      label: mapping.label,
      inputType: mapping.inputType,
      options: mapping.options,
    });
  }
  return result;
}

function GenerateDocumentMenu({ templates, onGenerate, generatingId }: {
  templates: DocumentTemplate[];
  onGenerate: (template: DocumentTemplate) => void;
  generatingId: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={generatingId !== null}>
          {generatingId !== null
            ? <Loader2 size={14} className="animate-spin mr-1.5" />
            : <FileText size={14} className="mr-1.5" />}
          Gerar documento
          <ChevronDown size={14} className="ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => onGenerate(t)}>{t.name}</DropdownMenuItem>
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

function DocumentCard({ template, residentId, signedDoc, residentName, onGenerate, generating }: {
  template: DocumentTemplate;
  residentId: string;
  signedDoc: ResidentDocument | null;
  residentName: string;
  onGenerate: (template: DocumentTemplate) => void;
  generating: boolean;
}) {
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

interface Props {
  residentId: string;
  residentName: string;
}

export function AttachmentsTab({ residentId, residentName }: Props) {
  const { data: resident } = useResidentById(residentId);
  const { data: signedDocs = [] } = useResidentDocuments(residentId);
  const { data: attachments = [] } = useResidentAttachments(residentId);
  const { data: templates = [] } = useDocumentTemplates();

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [missingDialog, setMissingDialog] = useState<{
    missingFields: MissingField[];
    template: DocumentTemplate;
  } | null>(null);

  const downloadPdf = useCallback(async (template: DocumentTemplate) => {
    setGeneratingId(template.id);
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
      setGeneratingId(null);
    }
  }, [residentId, residentName]);

  const handleGenerateRequest = useCallback((template: DocumentTemplate) => {
    if (!resident) {
      downloadPdf(template);
      return;
    }
    const vars = extractTemplateVars(template.content);
    const missing = findMissingFields(vars, resident);
    if (missing.length === 0) {
      downloadPdf(template);
    } else {
      setMissingDialog({ missingFields: missing, template });
    }
  }, [resident, downloadPdf]);

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
            <GenerateDocumentMenu
              templates={optionalTemplates}
              onGenerate={handleGenerateRequest}
              generatingId={generatingId}
            />
          )}
        </div>

        {requiredTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhum template marcado como obrigatório no acolhimento.</p>
        ) : (
          requiredTemplates.map((template) => (
            <DocumentCard
              key={template.id}
              template={template}
              residentId={residentId}
              residentName={residentName}
              signedDoc={docByTemplate[template.id] ?? null}
              onGenerate={handleGenerateRequest}
              generating={generatingId === template.id}
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
          attachments.map((a) => <AttachmentRow key={a.id} attachment={a} />)
        )}
      </div>

      <MissingFieldsDialog
        open={missingDialog !== null}
        onClose={() => setMissingDialog(null)}
        missingFields={missingDialog?.missingFields ?? []}
        residentId={residentId}
        onSaved={() => {
          if (missingDialog) downloadPdf(missingDialog.template);
        }}
      />
    </div>
  );
}
