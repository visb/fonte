import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { residentSchema, type ResidentFormData } from '../../lib/residentSchema';
import { ResidentFormSections } from '../ResidentFormSections';
import type { ParseResult } from '../../lib/types';

interface ImportReviewStepProps {
  parseResult: ParseResult;
  initialValues: Partial<ResidentFormData>;
  onBack: () => void;
  onNext: (values: ResidentFormData) => void;
}

export function ImportReviewStep({
  parseResult,
  initialValues,
  onBack,
  onNext,
}: ImportReviewStepProps) {
  const { data: houses = [], isLoading: loadingHouses } = useHouses();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ResidentFormData>({
    resolver: zodResolver(residentSchema),
    defaultValues: {
      name: '',
      houseId: '',
      gender: '',
      maritalStatus: '',
      familyInvestment: '',
      ...initialValues,
    },
  });

  // Auto-match house name to houseId once houses are loaded
  useEffect(() => {
    if (!loadingHouses && parseResult.houseName && houses.length > 0) {
      const normalise = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const target = normalise(parseResult.houseName);
      const found = houses.find((h) => normalise(h.name).includes(target) || target.includes(normalise(h.name)));
      if (found) setValue('houseId', found.id);
    }
  }, [loadingHouses, houses, parseResult.houseName, setValue]);

  // Re-apply parsed values whenever initialValues changes (e.g. user went back and re-uploaded)
  useEffect(() => {
    reset({
      name: '',
      houseId: '',
      gender: '',
      maritalStatus: '',
      familyInvestment: '',
      ...initialValues,
    });
  }, [initialValues, reset]);

  if (loadingHouses) return <LoadingState />;

  const hasWarnings = Object.keys(parseResult.warnings).length > 0;

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-semibold">Revisar dados do residente</h2>
          <p className="text-sm text-muted-foreground">
            Confira os dados extraídos da ficha e corrija o que for necessário.
          </p>
        </div>
      </div>

      {hasWarnings && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-400">
            <AlertTriangle size={14} />
            Atenção — campos que precisam de revisão manual
          </div>
          <ul className="text-xs text-yellow-700 dark:text-yellow-500 space-y-0.5 pl-5 list-disc">
            {Object.values(parseResult.warnings).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {parseResult.houseName && !watch('houseId') && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-400">
          Casa detectada na ficha: <strong>{parseResult.houseName}</strong> — selecione a casa correspondente abaixo.
        </div>
      )}

      <ResidentFormSections
        register={register}
        errors={errors}
        houses={houses}
        watchFamilyInvestment={watch('familyInvestment')}
      />

      <div className="flex justify-between gap-3 pt-6">
        <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
          <ArrowLeft size={14} />
          Voltar
        </Button>
        <Button type="submit" className="gap-2">
          Próximo: Familiares
          <ArrowRight size={14} />
        </Button>
      </div>
    </form>
  );
}
