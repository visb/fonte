import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { FollowUpType, FollowUpAccessLevel, ResidentStatus, todayInSaoPaulo } from '@fonte/types';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useDocumentTemplates } from '@/features/settings/hooks/useDocumentTemplates';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { getErrorMessage, isNotFoundError } from '@/lib/errors';
import { applyCpfConflict } from '@/lib/cpf';
import {
  useCreateResident,
  useResidentById,
  useResidentDocuments,
} from '../hooks/useResidents';
import { useAdmissionDraft } from '../hooks/useAdmissionDraft';
import { allRequiredDocsSigned } from '../lib/admissionGate';
import { admissionDraftKey, type AdmissionDraft } from '../lib/admissionDraft';
import {
  residentSchema,
  buildResidentPayload,
  FICHA_FIELDS,
  ADMISSAO_FIELDS,
  type ResidentFormData,
} from '../lib/residentSchema';
import {
  ResidentFichaSections,
  ResidentAdmissionSections,
} from '../components/ResidentFormSections';
import { WizardSteps } from '../components/wizard/WizardSteps';
import { FirstPaymentDetails } from '../components/wizard/FirstPaymentDetails';
import { AdmissionWizardFooter } from '../components/wizard/AdmissionWizardFooter';
import { DraftResumeBanner } from '../components/wizard/DraftResumeBanner';
import { DiscardDraftDialog } from '../components/wizard/DiscardDraftDialog';
import { RelativesTab } from '../components/tabs/RelativesTab';
import { AttachmentsTab } from '../components/tabs/AttachmentsTab';

const STEPS = ['Ficha de cadastro', 'Admissão', 'Familiares', 'Documentos'];
// Story 203: "hoje" no fuso da operação — é o `max` da entrada.
const today = todayInSaoPaulo();
const GATEWAY = '/residents/admission';

/** Story 211: aviso de reanexar o que o rascunho não guarda (decisão 2). */
function reattachNotice(draft: AdmissionDraft): string | null {
  if (draft.residentId) return null;
  if (draft.hadPhoto && draft.hadProof) return 'A foto e o comprovante do 1º pagamento não ficam no rascunho. Anexe-os novamente.';
  if (draft.hadPhoto) return 'A foto não fica no rascunho. Anexe-a novamente.';
  if (draft.hadProof) return 'O comprovante do 1º pagamento não fica no rascunho. Anexe-o novamente.';
  return null;
}

export function AdmissionWizardPage() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const pendingPhotoRef = useRef<Blob | null>(null);

  const [step, setStep] = useState(0);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [firstPaymentPaid, setFirstPaymentPaid] = useState(false);
  const [firstPaymentMethod, setFirstPaymentMethod] = useState('');
  const [firstPaymentProof, setFirstPaymentProof] = useState<File | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: houses = [], isLoading: loadingHouses } = useHouses();

  const {
    register,
    control,
    trigger,
    getValues,
    watch,
    reset,
    setError: setFieldError,
    formState: { errors },
  } = useForm<ResidentFormData>({
    resolver: zodResolver(residentSchema),
    defaultValues: { entryDate: today },
  });

  // Story 211: rascunho local — debounce do form + gravação imediata de passo/id.
  const draft = useAdmissionDraft<ResidentFormData>({
    storageKey: userId ? admissionDraftKey(userId) : null,
    watch,
    snapshot: () => ({
      values: getValues(),
      step,
      residentId,
      firstPaymentPaid,
      firstPaymentMethod,
      hadPhoto: !!pendingPhotoRef.current,
      hadProof: !!firstPaymentProof,
    }),
    saveImmediatelyOn: [step, residentId, firstPaymentPaid, firstPaymentMethod],
  });

  const createMutation = useCreateResident();

  // Gating — only read once the resident exists.
  const { data: signedDocs = [] } = useResidentDocuments(residentId ?? '', { enabled: !!residentId });
  // Sem id o hook já fica desabilitado (`enabled: !!id`); a query é a mesma que a
  // aba de anexos do passo 4 usa, então vem do cache, sem viagem extra.
  const { data: resident, error: residentError } = useResidentById(residentId ?? '');
  const { data: templates = [] } = useDocumentTemplates();
  // Story 160 — o gate só conta os obrigatórios que valem para o status do filho
  // (a regra em si vive em lib/admissionGate.ts; a page só orquestra).
  const allDocsSigned = allRequiredDocsSigned(templates, signedDocs, resident?.status);

  // Story 211 (decisão 6): o filho do rascunho retomado sumiu do servidor → descarta.
  useEffect(() => {
    if (!residentId || !isNotFoundError(residentError)) return;
    // reset antes do clear: o reset dispara o watch, e o clear cancela esse salvamento.
    reset({ entryDate: today });
    draft.clear();
    setResidentId(null);
    setStep(0);
    setNotice('O filho deste rascunho não existe mais. O rascunho foi descartado.');
  }, [residentId, residentError, draft, reset]);

  const handleResume = () => {
    const saved = draft.resume();
    if (!saved) return;
    reset({ entryDate: today, ...saved.values });
    // Com o filho já criado, o wizard segue com o mesmo id — sem recriar (duplicidade).
    setStep(Math.max(0, Math.min(saved.step, saved.residentId ? 3 : 1)));
    setResidentId(saved.residentId);
    setFirstPaymentPaid(saved.firstPaymentPaid);
    setFirstPaymentMethod(saved.firstPaymentMethod);
    setNotice(reattachNotice(saved));
  };

  const handleCancel = () => {
    if (draft.hasData()) setCancelOpen(true);
    else navigate(GATEWAY);
  };

  const confirmCancel = () => {
    draft.clear();
    navigate(GATEWAY);
  };

  const ensureResident = async () => {
    setError(null);
    setAdvancing(true);
    try {
      const values = getValues();
      // status is not a wizard field — strip the null it would produce.
      const { status: _status, ...payload } = buildResidentPayload(values);

      if (residentId) {
        await api.residents.update(residentId, payload as Parameters<typeof api.residents.update>[1]);
        setStep(2);
        return;
      }

      const resident = await createMutation.mutateAsync({
        data: { ...payload, status: ResidentStatus.ACTIVE } as Parameters<typeof api.residents.create>[0],
        photo: pendingPhotoRef.current,
      });

      if (firstPaymentPaid) {
        try {
          const followUp = await api.residents.createFollowUp(resident.id, {
            type: FollowUpType.MONTHLY_CONTRIBUTION,
            date: today,
            accessLevel: FollowUpAccessLevel.ALL,
            description: firstPaymentMethod || undefined,
          });
          if (firstPaymentProof) {
            const fd = new window.FormData();
            fd.append('file', firstPaymentProof);
            await api.residents.uploadFollowUpAttachment(resident.id, followUp.id, fd);
          }
        } catch {
          // non-critical — continue
        }
      }

      // O id vai para o rascunho na hora (saveImmediatelyOn) — fecha o buraco da duplicidade.
      setResidentId(resident.id);
      setStep(2);
    } catch (e) {
      // Story 219: CPF em uso → volta à ficha com o erro no campo (e o link).
      if (applyCpfConflict(e, setFieldError)) setStep(0);
      else setError(getErrorMessage(e, 'Erro ao registrar acolhimento.'));
    } finally {
      setAdvancing(false);
    }
  };

  const handleNext = async () => {
    if (step === 0) {
      if (await trigger(FICHA_FIELDS)) setStep(1);
      return;
    }
    if (step === 1) {
      if (await trigger(ADMISSAO_FIELDS)) await ensureResident();
      return;
    }
    if (step === 2) {
      setStep(3);
    }
  };

  const handleFinish = async () => {
    if (!residentId) return;
    setError(null);
    setAdvancing(true);
    try {
      // O filho já nasce ACTIVE no passo de admissão; o update cobre acolhimentos
      // antigos, criados antes disso, que ficaram parados em PRE_ADMISSION.
      await api.residents.update(residentId, { status: ResidentStatus.ACTIVE });
      draft.clear();
      navigate(`/residents/${residentId}?tab=overview`);
    } catch (e) {
      setError(getErrorMessage(e, 'Erro ao concluir acolhimento.'));
      setAdvancing(false);
    }
  };

  if (loadingHouses) return <LoadingState />;

  const header = (
    <div className="flex items-center gap-3 mb-6">
      <Button variant="ghost" size="icon" asChild>
        <Link to={GATEWAY}>
          <ArrowLeft size={16} />
        </Link>
      </Button>
      <h1 className="text-2xl font-bold">Novo acolhimento</h1>
    </div>
  );

  if (draft.pendingDraft) {
    return (
      <div className="max-w-2xl">
        {header}
        <DraftResumeBanner
          name={draft.pendingDraft.values.name}
          savedAt={draft.pendingDraft.savedAt}
          onContinue={handleResume}
          onDiscard={draft.clear}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {header}

      <WizardSteps steps={STEPS} current={step} />

      {notice && <p className="text-sm text-amber-600 pb-4">{notice}</p>}

      <div className="space-y-2">
        {step === 0 && (
          <>
            <div className="flex justify-center pb-2">
              <AvatarUpload onBlobChange={(blob) => { pendingPhotoRef.current = blob; }} />
            </div>
            <ResidentFichaSections register={register} control={control} errors={errors} />
          </>
        )}

        {step === 1 && (
          <ResidentAdmissionSections
            register={register}
            control={control}
            errors={errors}
            houses={houses}
            watchFamilyInvestment={watch('familyInvestment')}
            showFirstPayment
            firstPaymentPaid={firstPaymentPaid}
            onFirstPaymentChange={setFirstPaymentPaid}
            firstPaymentSlot={
              <FirstPaymentDetails
                method={firstPaymentMethod}
                onMethodChange={setFirstPaymentMethod}
                file={firstPaymentProof}
                onFileChange={setFirstPaymentProof}
              />
            }
          />
        )}

        {step === 2 && residentId && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cadastre os familiares do acolhido. Você pode adicioná-los depois, se necessário.
            </p>
            <RelativesTab residentId={residentId} />
          </div>
        )}

        {step === 3 && residentId && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gere e anexe os documentos assinados. Você pode concluir agora e anexá-los depois.
            </p>
            <AttachmentsTab residentId={residentId} residentName={watch('name') ?? ''} />
            {!allDocsSigned && (
              <p className="text-sm text-amber-600 pt-2">
                Há documentos obrigatórios pendentes. Você pode concluir agora e anexá-los depois.
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive pt-4">{error}</p>}

      <AdmissionWizardFooter
        step={step}
        isLast={step === STEPS.length - 1}
        advancing={advancing}
        draftSavedAt={draft.savedAt}
        onCancel={handleCancel}
        onBack={() => setStep(step - 1)}
        onNext={handleNext}
        onFinish={handleFinish}
      />

      <DiscardDraftDialog open={cancelOpen} onOpenChange={setCancelOpen} onConfirm={confirmCancel} />
    </div>
  );
}
