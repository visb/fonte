import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { FollowUpType, FollowUpAccessLevel, ResidentStatus, todayInSaoPaulo } from '@fonte/types';
import { api } from '@/lib/api';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useDocumentTemplates } from '@/features/settings/hooks/useDocumentTemplates';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { getErrorMessage } from '@/lib/errors';
import {
  useCreateResident,
  useResidentById,
  useResidentDocuments,
} from '../hooks/useResidents';
import { allRequiredDocsSigned } from '../lib/admissionGate';
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
import { RelativesTab } from '../components/tabs/RelativesTab';
import { AttachmentsTab } from '../components/tabs/AttachmentsTab';

const STEPS = ['Ficha de cadastro', 'Admissão', 'Familiares', 'Documentos'];
// Story 203: "hoje" no fuso da operação — é o `max` da entrada.
const today = todayInSaoPaulo();

export function AdmissionWizardPage() {
  const navigate = useNavigate();
  const pendingPhotoRef = useRef<Blob | null>(null);

  const [step, setStep] = useState(0);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [firstPaymentPaid, setFirstPaymentPaid] = useState(false);
  const [firstPaymentMethod, setFirstPaymentMethod] = useState('');
  const [firstPaymentProof, setFirstPaymentProof] = useState<File | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: houses = [], isLoading: loadingHouses } = useHouses();

  const {
    register,
    control,
    trigger,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ResidentFormData>({
    resolver: zodResolver(residentSchema),
    defaultValues: { entryDate: today },
  });

  const createMutation = useCreateResident();

  // Gating — only read once the resident exists.
  const { data: signedDocs = [] } = useResidentDocuments(residentId ?? '', { enabled: !!residentId });
  // Sem id o hook já fica desabilitado (`enabled: !!id`); a query é a mesma que a
  // aba de anexos do passo 4 usa, então vem do cache, sem viagem extra.
  const { data: resident } = useResidentById(residentId ?? '');
  const { data: templates = [] } = useDocumentTemplates();
  // Story 160 — o gate só conta os obrigatórios que valem para o status do filho
  // (a regra em si vive em lib/admissionGate.ts; a page só orquestra).
  const allDocsSigned = allRequiredDocsSigned(templates, signedDocs, resident?.status);

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

      setResidentId(resident.id);
      setStep(2);
    } catch (e) {
      setError(getErrorMessage(e, 'Erro ao registrar acolhimento.'));
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
      navigate(`/residents/${residentId}?tab=overview`);
    } catch (e) {
      setError(getErrorMessage(e, 'Erro ao concluir acolhimento.'));
      setAdvancing(false);
    }
  };

  if (loadingHouses) return <LoadingState />;

  const isLast = step === STEPS.length - 1;
  const nextDisabled = advancing;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/residents/admission">
            <ArrowLeft size={16} />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Novo acolhimento</h1>
      </div>

      <WizardSteps steps={STEPS} current={step} />

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

      <div className="flex justify-between gap-3 pt-6">
        {step === 0 ? (
          <Button type="button" variant="outline" asChild>
            <Link to="/residents/admission">Cancelar</Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={advancing}>
            <ArrowLeft size={16} className="mr-1.5" />
            Voltar
          </Button>
        )}

        {isLast ? (
          <Button type="button" onClick={handleFinish} disabled={nextDisabled}>
            <Check size={16} className="mr-1.5" />
            {advancing ? 'Concluindo...' : 'Concluir acolhimento'}
          </Button>
        ) : (
          <Button type="button" onClick={handleNext} disabled={nextDisabled}>
            {advancing ? 'Salvando...' : 'Avançar'}
            <ArrowRight size={16} className="ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
