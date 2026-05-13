import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useGoBack } from '@/lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, ChevronDown, Download, ExternalLink, FileText,
  KeyRound, Loader2, Paperclip, Pencil, Phone, Plus, Trash2, Upload, User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Gender, MaritalStatus } from '@fonte/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { maskCPF, maskPhone, maskRG, withMask } from '../lib/masks';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';
import {
  useResidentById, useResidentRelatives, useAddRelative, useDeleteRelative,
  useResidentDocuments, useResidentAttachments, useAddAttachment, useDeleteAttachment, useUploadSignedDocument,
} from '../hooks/useResidents';
import { GenerateResidentAccessDialog } from '../components/GenerateResidentAccessDialog';
import { ResetResidentPasswordDialog } from '../components/ResetResidentPasswordDialog';
import { GenerateRelativeAccessDialog } from '../components/GenerateRelativeAccessDialog';
import { ResetRelativePasswordDialog } from '../components/ResetRelativePasswordDialog';
import { useDocumentTemplates } from '@/features/settings/hooks/useDocumentTemplates';

import type { Relative, DocumentTemplate, ResidentDocument, ResidentAttachment } from '@fonte/api-client';

const GENDER_LABELS: Record<string, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
};

const MARITAL_LABELS: Record<string, string> = {
  [MaritalStatus.SINGLE]: 'Solteiro(a)',
  [MaritalStatus.MARRIED]: 'Casado(a)',
  [MaritalStatus.DIVORCED]: 'Divorciado(a)',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function computeAge(birthDate: string | null): string {
  if (!birthDate) return '';
  const today = new Date();
  const [y, m, d] = birthDate.split('T')[0].split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 - m < 0 || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return ` (${age} anos)`;
}

function val(v: string | number | null | undefined, format?: (s: string) => string): string {
  if (v == null || v === '') return '—';
  return format ? format(String(v)) : String(v);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-2 border-b mb-3">
      {children}
    </h3>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
      {children}
    </div>
  );
}

function InfoRow({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <>
      <span className={cn('text-muted-foreground', full && 'sm:col-span-2')}>{label}</span>
      <span className={cn(full && 'sm:col-span-2')}>{value || '—'}</span>
    </>
  );
}

const relativeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  relationship: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});
type RelativeFormData = z.infer<typeof relativeSchema>;

const TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'timeline', label: 'Acompanhamento' },
  { id: 'relatives', label: 'Familiares' },
  { id: 'attachments', label: 'Anexos' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/residents');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [addRelativeOpen, setAddRelativeOpen] = useState(false);
  const [deleteRelativeTarget, setDeleteRelativeTarget] = useState<Relative | null>(null);
  const [generateAccessOpen, setGenerateAccessOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [relativeAccessTarget, setRelativeAccessTarget] = useState<Relative | null>(null);
  const [relativeResetTarget, setRelativeResetTarget] = useState<Relative | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<RelativeFormData>({ resolver: zodResolver(relativeSchema) });

  const { data: resident, isLoading, isError } = useResidentById(id!);
  const { data: relatives = [], isLoading: loadingRelatives } = useResidentRelatives(id!);

  const isAttachmentsTab = activeTab === 'attachments';
  const { data: signedDocs = [] } = useResidentDocuments(id!, { enabled: isAttachmentsTab });
  const { data: attachments = [] } = useResidentAttachments(id!, { enabled: isAttachmentsTab });
  const { data: templates = [] } = useDocumentTemplates({ enabled: isAttachmentsTab });

  const addRelativeMutation = useAddRelative(id!);
  const deleteRelativeMutation = useDeleteRelative(id!);

  const onAddRelative = (data: RelativeFormData) => {
    addRelativeMutation.mutate(data, {
      onSuccess: () => { setAddRelativeOpen(false); reset(); },
    });
  };

  if (isLoading) return <LoadingState />;
  if (isError || !resident) return <ErrorState message="Acolhido não encontrado." />;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <div
          className={cn(
            'w-12 h-12 rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden',
            resident.photoUrl && 'cursor-pointer hover:opacity-80 transition-opacity',
          )}
          onClick={() => resident.photoUrl && setPhotoModalOpen(true)}
        >
          {resident.photoUrl ? (
            <img src={api.photoUrl(resident.photoUrl)!} alt={resident.name} className="w-full h-full object-cover" />
          ) : (
            <User size={22} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{resident.name}</h1>
            <Badge variant={RESIDENT_STATUS_VARIANT[resident.status]}>
              {RESIDENT_STATUS_LABELS[resident.status]}
            </Badge>
          </div>
          {resident.house && (
            <p className="text-sm text-muted-foreground mt-0.5">{resident.house.name}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/residents/${id}/edit`}>
            <Pencil size={14} className="mr-2" />
            Editar
          </Link>
        </Button>
      </div>

      <div className="border-b flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-1">
          <SectionTitle>Identificação</SectionTitle>
          <InfoGrid>
            <InfoRow label="Nome" value={resident.name} full />
            <InfoRow label="CPF" value={val(resident.cpf, maskCPF)} />
            <InfoRow label="RG" value={val(resident.rg, maskRG)} />
            <InfoRow
              label="Data de nascimento"
              value={resident.birthDate ? `${formatDate(resident.birthDate)}${computeAge(resident.birthDate)}` : '—'}
            />
            <InfoRow
              label="Gênero"
              value={resident.gender ? (GENDER_LABELS[resident.gender] ?? resident.gender) : '—'}
            />
          </InfoGrid>

          <SectionTitle>Admissão</SectionTitle>
          <InfoGrid>
            <InfoRow label="Casa" value={resident.house?.name ?? '—'} />
            <InfoRow label="Data de entrada" value={formatDate(resident.entryDate)} />
            <InfoRow label="Data de saída" value={formatDate(resident.exitDate)} />
            <InfoRow label="Telefone de contato" value={val(resident.contactPhone, maskPhone)} />
            <InfoRow label="Endereço" value={val(resident.address)} full />
          </InfoGrid>

          <SectionTitle>Perfil Social</SectionTitle>
          <InfoGrid>
            <InfoRow
              label="Estado civil"
              value={resident.maritalStatus ? (MARITAL_LABELS[resident.maritalStatus] ?? resident.maritalStatus) : '—'}
            />
            <InfoRow label="Filhos" value={String(resident.children ?? 0)} />
            <InfoRow label="Ocupação" value={val(resident.occupation)} />
            <InfoRow label="Escolaridade" value={val(resident.education)} />
            <InfoRow label="Religião" value={val(resident.religion)} />
            <InfoRow label="Dependência química" value={val(resident.addiction)} />
          </InfoGrid>

          <SectionTitle>Saúde</SectionTitle>
          <InfoGrid>
            <InfoRow label="Problemas de saúde" value={val(resident.healthIssues)} full />
            <InfoRow label="Medicação contínua" value={val(resident.continuousMedication)} full />
            <InfoRow label="Peso" value={resident.weight != null ? `${resident.weight} kg` : '—'} />
            <InfoRow label="Altura" value={resident.height != null ? `${resident.height} cm` : '—'} />
          </InfoGrid>

          <SectionTitle>Família</SectionTitle>
          <InfoGrid>
            <InfoRow label="Investimento familiar" value={val(resident.familyInvestment)} full />
          </InfoGrid>

          <SectionTitle>Acesso Digital</SectionTitle>
          <div className="flex items-center justify-between py-2">
            {resident.userId ? (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">E-mail: </span>
                  <span>{resident.user?.email ?? '—'}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetPasswordOpen(true)}
                >
                  <KeyRound size={14} className="mr-2" />
                  Resetar Senha
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Sem acesso gerado.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGenerateAccessOpen(true)}
                >
                  <KeyRound size={14} className="mr-2" />
                  Gerar Acesso
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="py-12 text-center text-muted-foreground text-sm space-y-1">
          <p className="font-medium">Em desenvolvimento</p>
          <p>Esta seção registrará ocorrências e mudanças de status durante o internamento.</p>
        </div>
      )}

      {activeTab === 'relatives' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { reset(); setAddRelativeOpen(true); }}>
              <Plus size={14} className="mr-2" />
              Adicionar familiar
            </Button>
          </div>

          {loadingRelatives ? (
            <LoadingState message="Carregando familiares..." />
          ) : relatives.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum familiar cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {relatives.map((relative) => (
                <div key={relative.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <User size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{relative.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      {relative.relationship && <span>{relative.relationship}</span>}
                      {relative.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} />
                          {maskPhone(relative.phone)}
                        </span>
                      )}
                      {relative.userId ? (
                        <span className="text-green-600">App ativo</span>
                      ) : (
                        <span>Sem acesso</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {relative.userId ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Resetar senha"
                        onClick={() => setRelativeResetTarget(relative)}
                      >
                        <KeyRound size={15} />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerar acesso ao app"
                        onClick={() => setRelativeAccessTarget(relative)}
                      >
                        <KeyRound size={15} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteRelativeTarget(relative)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'attachments' && (
        <AttachmentsTab
          residentId={id!}
          residentName={resident.name}
          signedDocs={signedDocs}
          attachments={attachments}
          templates={templates}
        />
      )}

      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-sm p-2">
          <img src={api.photoUrl(resident.photoUrl)!} alt={resident.name} className="w-full rounded-md object-contain max-h-[80vh]" />
        </DialogContent>
      </Dialog>

      <Dialog open={addRelativeOpen} onOpenChange={(open) => !open && setAddRelativeOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar familiar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAddRelative)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rel-name">Nome *</Label>
                <Input id="rel-name" {...register('name')} placeholder="Nome completo" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rel-relationship">Parentesco</Label>
                <Input id="rel-relationship" {...register('relationship')} placeholder="Ex: Pai, Mãe, Irmão..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rel-phone">Telefone</Label>
                <Input id="rel-phone" {...withMask(register('phone'), maskPhone)} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRelativeOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || addRelativeMutation.isPending}>Adicionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRelativeTarget} onOpenChange={(open) => !open && setDeleteRelativeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover familiar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteRelativeTarget?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRelativeTarget && deleteRelativeMutation.mutate(deleteRelativeTarget.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenerateResidentAccessDialog
        open={generateAccessOpen}
        onClose={() => setGenerateAccessOpen(false)}
        resident={resident ? { id: resident.id, name: resident.name } : null}
      />
      <ResetResidentPasswordDialog
        open={resetPasswordOpen}
        onClose={() => setResetPasswordOpen(false)}
        resident={resident ? { id: resident.id, name: resident.name } : null}
      />
      <GenerateRelativeAccessDialog
        open={!!relativeAccessTarget}
        onClose={() => setRelativeAccessTarget(null)}
        relative={relativeAccessTarget}
      />
      <ResetRelativePasswordDialog
        open={!!relativeResetTarget}
        onClose={() => setRelativeResetTarget(null)}
        relative={relativeResetTarget}
      />
    </div>
  );
}

// ─── Attachments tab ─────────────────────────────────────────────────────────

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

function AttachmentsTab({
  residentId, residentName, signedDocs, attachments, templates,
}: {
  residentId: string;
  residentName: string;
  signedDocs: ResidentDocument[];
  attachments: ResidentAttachment[];
  templates: DocumentTemplate[];
}) {
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
