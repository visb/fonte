import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ChevronDown, Download, ExternalLink, FileText, Loader2, Paperclip, Pencil, Phone, Plus, Trash2, Upload, User } from 'lucide-react';
import { api, photoUrl } from '@/lib/api';
import { Gender, MaritalStatus, ResidentStatus } from '@fonte/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { maskCPF, maskPhone, maskRG, withMask } from './masks';

// ─── types ────────────────────────────────────────────────────────────────────

interface ResidentDetail {
  id: string;
  name: string;
  status: ResidentStatus;
  house: { id: string; name: string } | null;
  houseId: string;
  birthDate: string | null;
  cpf: string | null;
  rg: string | null;
  gender: string | null;
  address: string | null;
  entryDate: string | null;
  exitDate: string | null;
  contactPhone: string | null;
  maritalStatus: string | null;
  children: number;
  occupation: string | null;
  education: string | null;
  religion: string | null;
  addiction: string | null;
  healthIssues: string | null;
  continuousMedication: string | null;
  weight: number | null;
  height: number | null;
  familyInvestment: string | null;
  photoUrl: string | null;
}

interface Relative {
  id: string;
  name: string;
  phone: string | null;
  relationship: string | null;
}

interface DocumentTemplate {
  id: string;
  name: string;
  isRequired: boolean;
}

interface ResidentDocument {
  id: string;
  residentId: string;
  templateId: string;
  templateName: string;
  signed: boolean;
  signedFileUrl: string | null;
  signedAt: string | null;
  withinWindow: boolean;
}

interface ResidentAttachment {
  id: string;
  residentId: string;
  filename: string;
  fileUrl: string;
  createdAt: string;
}

// ─── labels ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ResidentStatus, string> = {
  [ResidentStatus.PRE_ADMISSION]: 'Pré-admissão',
  [ResidentStatus.ACTIVE]: 'Ativo',
  [ResidentStatus.DISCIPLINE]: 'Disciplina',
  [ResidentStatus.TEMP_LEAVE]: 'Saída temporária',
  [ResidentStatus.DISCHARGED]: 'Alta',
  [ResidentStatus.EVADED]: 'Evasão',
};

const STATUS_VARIANT: Record<
  ResidentStatus,
  'secondary' | 'success' | 'warning' | 'info' | 'purple' | 'destructive'
> = {
  [ResidentStatus.PRE_ADMISSION]: 'secondary',
  [ResidentStatus.ACTIVE]: 'success',
  [ResidentStatus.DISCIPLINE]: 'warning',
  [ResidentStatus.TEMP_LEAVE]: 'info',
  [ResidentStatus.DISCHARGED]: 'purple',
  [ResidentStatus.EVADED]: 'destructive',
};

const GENDER_LABELS: Record<string, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
};

const MARITAL_LABELS: Record<string, string> = {
  [MaritalStatus.SINGLE]: 'Solteiro(a)',
  [MaritalStatus.MARRIED]: 'Casado(a)',
  [MaritalStatus.DIVORCED]: 'Divorciado(a)',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── sub-components ───────────────────────────────────────────────────────────

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

function InfoRow({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <>
      <span className={cn('text-muted-foreground', full && 'sm:col-span-2')}>{label}</span>
      <span className={cn(full && 'sm:col-span-2')}>{value || '—'}</span>
    </>
  );
}

// ─── relative form ────────────────────────────────────────────────────────────

const relativeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  relationship: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});
type RelativeFormData = z.infer<typeof relativeSchema>;

// ─── api calls ────────────────────────────────────────────────────────────────

const fetchResident = (id: string) =>
  api.get<ResidentDetail>(`/residents/${id}`).then((r) => r.data);

const fetchRelatives = (residentId: string) =>
  api.get<Relative[]>(`/relatives?residentId=${residentId}`).then((r) => r.data);

const fetchDocuments = (residentId: string) =>
  api.get<ResidentDocument[]>(`/residents/${residentId}/documents`).then((r) => r.data);

const fetchAttachments = (residentId: string) =>
  api.get<ResidentAttachment[]>(`/residents/${residentId}/attachments`).then((r) => r.data);

const fetchTemplates = () =>
  api.get<DocumentTemplate[]>('/document-templates').then((r) => r.data);

const createRelative = (data: RelativeFormData & { residentId: string }) =>
  api.post<Relative>('/relatives', {
    name: data.name,
    residentId: data.residentId,
    phone: data.phone || null,
    relationship: data.relationship || null,
  }).then((r) => r.data);

const deleteRelative = (id: string) => api.delete(`/relatives/${id}`);

// ─── tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'timeline', label: 'Acompanhamento' },
  { id: 'relatives', label: 'Familiares' },
  { id: 'attachments', label: 'Anexos' },
] as const;
type TabId = (typeof TABS)[number]['id'];

// ─── page ─────────────────────────────────────────────────────────────────────

export function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const initialTab = (location.state as { tab?: TabId } | null)?.tab ?? 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [addRelativeOpen, setAddRelativeOpen] = useState(false);
  const [deleteRelativeTarget, setDeleteRelativeTarget] = useState<Relative | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RelativeFormData>({ resolver: zodResolver(relativeSchema) });

  const { data: resident, isLoading, isError } = useQuery({
    queryKey: ['residents', id],
    queryFn: () => fetchResident(id!),
    enabled: !!id,
  });

  const { data: relatives = [], isLoading: loadingRelatives } = useQuery({
    queryKey: ['relatives', id],
    queryFn: () => fetchRelatives(id!),
    enabled: !!id,
  });

  const { data: signedDocs = [] } = useQuery({
    queryKey: ['resident-documents', id],
    queryFn: () => fetchDocuments(id!),
    enabled: !!id && activeTab === 'attachments',
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['resident-attachments', id],
    queryFn: () => fetchAttachments(id!),
    enabled: !!id && activeTab === 'attachments',
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['document-templates'],
    queryFn: fetchTemplates,
    enabled: activeTab === 'attachments',
  });

  const addRelativeMutation = useMutation({
    mutationFn: createRelative,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatives', id] });
      setAddRelativeOpen(false);
      reset();
    },
  });

  const deleteRelativeMutation = useMutation({
    mutationFn: deleteRelative,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatives', id] });
      setDeleteRelativeTarget(null);
    },
  });

  const onAddRelative = (data: RelativeFormData) => {
    if (id) addRelativeMutation.mutate({ ...data, residentId: id });
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (isError || !resident) return <p className="text-destructive">Acolhido não encontrado.</p>;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/residents')}>
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
            <img
              src={photoUrl(resident.photoUrl)!}
              alt={resident.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={22} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{resident.name}</h1>
            <Badge variant={STATUS_VARIANT[resident.status]}>
              {STATUS_LABELS[resident.status]}
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

      {/* Tabs */}
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

      {/* ── Visão Geral ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-1">
          <SectionTitle>Identificação</SectionTitle>
          <InfoGrid>
            <InfoRow label="Nome" value={resident.name} full />
            <InfoRow label="CPF" value={val(resident.cpf, maskCPF)} />
            <InfoRow label="RG" value={val(resident.rg, maskRG)} />
            <InfoRow
              label="Data de nascimento"
              value={
                resident.birthDate
                  ? `${formatDate(resident.birthDate)}${computeAge(resident.birthDate)}`
                  : '—'
              }
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
              value={
                resident.maritalStatus
                  ? (MARITAL_LABELS[resident.maritalStatus] ?? resident.maritalStatus)
                  : '—'
              }
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
            <InfoRow
              label="Peso"
              value={resident.weight != null ? `${resident.weight} kg` : '—'}
            />
            <InfoRow
              label="Altura"
              value={resident.height != null ? `${resident.height} cm` : '—'}
            />
          </InfoGrid>

          <SectionTitle>Família</SectionTitle>
          <InfoGrid>
            <InfoRow label="Investimento familiar" value={val(resident.familyInvestment)} full />
          </InfoGrid>
        </div>
      )}

      {/* ── Acompanhamento ──────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="py-12 text-center text-muted-foreground text-sm space-y-1">
          <p className="font-medium">Em desenvolvimento</p>
          <p>Esta seção registrará ocorrências e mudanças de status durante o internamento.</p>
        </div>
      )}

      {/* ── Familiares ──────────────────────────────────────────────────────── */}
      {activeTab === 'relatives' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                reset();
                setAddRelativeOpen(true);
              }}
            >
              <Plus size={14} className="mr-2" />
              Adicionar familiar
            </Button>
          </div>

          {loadingRelatives ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : relatives.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Nenhum familiar cadastrado.
            </p>
          ) : (
            <div className="space-y-2">
              {relatives.map((relative) => (
                <div
                  key={relative.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                >
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
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteRelativeTarget(relative)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Anexos ──────────────────────────────────────────────────────────── */}
      {activeTab === 'attachments' && (
        <AttachmentsTab
          residentId={id!}
          residentName={resident.name}
          signedDocs={signedDocs}
          attachments={attachments}
          templates={templates}
          onDocumentUploaded={() => queryClient.invalidateQueries({ queryKey: ['resident-documents', id] })}
          onAttachmentChanged={() => queryClient.invalidateQueries({ queryKey: ['resident-attachments', id] })}
        />
      )}

      {/* ── Dialog: foto ampliada ───────────────────────────────────────────── */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-sm p-2">
          <img
            src={photoUrl(resident.photoUrl)!}
            alt={resident.name}
            className="w-full rounded-md object-contain max-h-[80vh]"
          />
        </DialogContent>
      </Dialog>

      {/* ── Dialog: adicionar familiar ───────────────────────────────────────── */}
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
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rel-relationship">Parentesco</Label>
                <Input
                  id="rel-relationship"
                  {...register('relationship')}
                  placeholder="Ex: Pai, Mãe, Irmão..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rel-phone">Telefone</Label>
                <Input
                  id="rel-phone"
                  {...withMask(register('phone'), maskPhone)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddRelativeOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || addRelativeMutation.isPending}
              >
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: remover familiar ───────────────────────────────────── */}
      <AlertDialog
        open={!!deleteRelativeTarget}
        onOpenChange={(open) => !open && setDeleteRelativeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover familiar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{' '}
              <strong>{deleteRelativeTarget?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteRelativeTarget &&
                deleteRelativeMutation.mutate(deleteRelativeTarget.id)
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  residentId,
  residentName,
  signedDocs,
  attachments,
  templates,
  onDocumentUploaded,
  onAttachmentChanged,
}: {
  residentId: string;
  residentName: string;
  signedDocs: ResidentDocument[];
  attachments: ResidentAttachment[];
  templates: DocumentTemplate[];
  onDocumentUploaded: () => void;
  onAttachmentChanged: () => void;
}) {
  const docByTemplate = Object.fromEntries(signedDocs.map((d) => [d.templateId, d]));
  const requiredTemplates = templates.filter((t) => t.isRequired);
  const optionalTemplates = templates.filter((t) => !t.isRequired);

  return (
    <div className="space-y-6">
      {/* Documentos de acolhimento */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Documentos de acolhimento
          </h3>
          {optionalTemplates.length > 0 && (
            <GenerateDocumentMenu
              templates={optionalTemplates}
              residentId={residentId}
              residentName={residentName}
            />
          )}
        </div>

        {requiredTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhum template marcado como obrigatório no acolhimento.
          </p>
        ) : (
          requiredTemplates.map((template) => (
            <DocumentCard
              key={template.id}
              templateId={template.id}
              templateName={template.name}
              residentId={residentId}
              residentName={residentName}
              signedDoc={docByTemplate[template.id] ?? null}
              onUploaded={onDocumentUploaded}
            />
          ))
        )}
      </div>

      {/* Outros anexos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Outros anexos
          </h3>
          <AttachmentUploadButton residentId={residentId} onUploaded={onAttachmentChanged} />
        </div>

        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhum anexo adicionado.</p>
        ) : (
          attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              onDeleted={onAttachmentChanged}
            />
          ))
        )}
      </div>
    </div>
  );
}

function GenerateDocumentMenu({
  templates,
  residentId,
  residentName,
}: {
  templates: DocumentTemplate[];
  residentId: string;
  residentName: string;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadPdf = async (template: DocumentTemplate) => {
    setDownloading(template.id);
    try {
      const res = await api.get<Blob>(`/residents/${residentId}/documents/${template.id}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
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
          {downloading !== null ? (
            <Loader2 size={14} className="animate-spin mr-1.5" />
          ) : (
            <FileText size={14} className="mr-1.5" />
          )}
          Gerar documento
          <ChevronDown size={14} className="ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => downloadPdf(t)}>
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AttachmentUploadButton({
  residentId,
  onUploaded,
}: {
  residentId: string;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new window.FormData();
      fd.append('file', file);
      await api.post(`/residents/${residentId}/attachments`, fd, {
        headers: { 'Content-Type': undefined },
      });
    },
    onSuccess: onUploaded,
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        {mutation.isPending ? (
          <Loader2 size={14} className="animate-spin mr-1.5" />
        ) : (
          <Upload size={14} className="mr-1.5" />
        )}
        Adicionar anexo
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) mutation.mutate(file);
          e.target.value = '';
        }}
      />
    </>
  );
}

function AttachmentRow({
  attachment,
  onDeleted,
}: {
  attachment: ResidentAttachment;
  onDeleted: () => void;
}) {
  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/residents/${attachment.residentId}/attachments/${attachment.id}`),
    onSuccess: onDeleted,
  });

  const date = new Date(attachment.createdAt).toLocaleDateString('pt-BR');

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Paperclip size={16} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.filename}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(photoUrl(attachment.fileUrl)!, '_blank', 'noreferrer')}
        >
          <ExternalLink size={14} className="mr-1.5" />
          Abrir
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </Button>
      </div>
    </div>
  );
}

function DocumentCard({
  templateId,
  templateName,
  residentId,
  signedDoc,
  onUploaded,
  residentName,
}: {
  templateId: string;
  templateName: string;
  residentId: string;
  signedDoc: ResidentDocument | null;
  onUploaded: () => void;
  residentName: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new window.FormData();
      fd.append('file', file);
      await api.post(`/residents/${residentId}/documents/${templateId}/signed`, fd, {
        headers: { 'Content-Type': undefined },
      });
    },
    onSuccess: onUploaded,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  const pdfFilename = `${slugify(`${residentName} ${templateName}`)}.pdf`;

  const [downloading, setDownloading] = useState(false);
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.get<Blob>(`/residents/${residentId}/documents/${templateId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
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
    ? new Date(signedDoc.signedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
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
            <Badge variant="outline" className="text-xs text-green-600 border-green-200">
              Assinado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Pendente assinatura
            </Badge>
          )}
          {signedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">{signedAt}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" disabled={downloading} onClick={downloadPdf}>
          {downloading ? (
            <Loader2 size={14} className="animate-spin mr-1.5" />
          ) : (
            <Download size={14} className="mr-1.5" />
          )}
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
            {uploadMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            <span className="ml-1.5 hidden sm:inline">
              {wasSigned ? 'Substituir' : 'Enviar assinado'}
            </span>
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
