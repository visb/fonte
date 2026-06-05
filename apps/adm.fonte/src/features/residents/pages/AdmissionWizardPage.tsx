import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { FollowUpType, FollowUpAccessLevel, ResidentStatus } from '@fonte/types';
import { api } from '@/lib/api';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useDocumentTemplates } from '@/features/settings/hooks/useDocumentTemplates';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { getErrorMessage } from '@/lib/errors';
import {
  useCreateResident,
  useResidentRelatives,
  useResidentDocuments,
} from '../hooks/useResidents';
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
const today = new Date().toISOString().split('T')[0];

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
  const { data: relatives = [] } = useResidentRelatives(residentId ?? '');
  const { data: signedDocs = [] } = useResidentDocuments(residentId ?? '', { enabled: !!residentId });
  const { data: templates = [] } = useDocumentTemplates();
  const requiredTemplates = templates.filter((t) => t.isRequired);
  const signedMap = new Map(signedDocs.map((d) => [d.templateId, d]));
  const allDocsSigned = requiredTemplates.every((t) => signedMap.get(t.id)?.signed);
  const hasRelative = relatives.length > 0;

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
        data: { ...payload, status: ResidentStatus.PRE_ADMISSION } as Parameters<typeof api.residents.create>[0],
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
    if (step === 2 && hasRelative) {
      setStep(3);
    }
  };

  const handleFinish = async () => {
    if (!residentId || !allDocsSigned) return;
    setError(null);
    setAdvancing(true);
    try {
      await api.residents.update(residentId, { status: ResidentStatus.ACTIVE });
      navigate(`/residents/${residentId}?tab=overview`);
    } catch (e) {
      setError(getErrorMessage(e, 'Erro ao concluir acolhimento.'));
      setAdvancing(false);
    }
  };

  if (loadingHouses) return <LoadingState />;

  const isLast = step === STEPS.length - 1;
  const nextDisabled =
    advancing ||
    (step === 2 && !hasRelative) ||
    (isLast && !allDocsSigned);

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
            <ResidentFichaSections register={register} errors={errors} />
          </>
        )}

        {step === 1 && (
          <ResidentAdmissionSections
            register={register}
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
              Cadastre pelo menos um familiar para continuar.
            </p>
            <RelativesTab residentId={residentId} />
          </div>
        )}

        {step === 3 && residentId && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gere e envie assinado todos os documentos obrigatórios de acolhimento para concluir.
            </p>
            <AttachmentsTab residentId={residentId} residentName={watch('name') ?? ''} />
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
