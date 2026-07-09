import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { ImportUploadStep } from '../components/import/ImportUploadStep';
import { ImportReviewStep } from '../components/import/ImportReviewStep';
import { ImportRelativesStep } from '../components/import/ImportRelativesStep';
import { ImportDocumentsStep } from '../components/import/ImportDocumentsStep';
import { ImportSummaryStep } from '../components/import/ImportSummaryStep';
import { ImportWarnings } from '../components/import/ImportWarnings';
import type { ParseResult, DraftRelative } from '../lib/types';
import type { ResidentFormData } from '../lib/residentSchema';

// Decodes a `data:<mime>;base64,<...>` URL into a Blob. Returns null for empty input.
function dataUrlToBlob(dataUrl: string | null): Blob | null {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ─── State ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface WizardState {
  step: Step;
  file: File | null;
  parseResult: ParseResult | null;
  residentValues: ResidentFormData | null;
  relatives: DraftRelative[];
  photo: Blob | null;
  extraFiles: File[];
}

const STEPS: { label: string }[] = [
  { label: 'Upload' },
  { label: 'Residente' },
  { label: 'Familiares' },
  { label: 'Documentos' },
  { label: 'Resumo' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ImportResidentPage() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    file: null,
    parseResult: null,
    residentValues: null,
    relatives: [],
    photo: null,
    extraFiles: [],
  });
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const { data: houses = [] } = useHouses();

  const setStep = (step: Step) => setState((s) => ({ ...s, step }));
  const setPhoto = (photo: Blob | null) => setState((s) => ({ ...s, photo }));
  const dismissWarning = (key: string) =>
    setDismissedWarnings((prev) => new Set(prev).add(key));

  // Step 1 → 2
  const handleParsed = (result: ParseResult, file: File) => {
    setState((s) => ({
      ...s,
      step: 2,
      file,
      parseResult: result,
      relatives: result.relatives,
      // Pre-fill the resident photo extracted from the document, if any.
      photo: dataUrlToBlob(result.photoBase64) ?? s.photo,
    }));
  };

  // Step 2 → 3
  const handleResidentNext = (values: ResidentFormData) => {
    setState((s) => ({ ...s, step: 3, residentValues: values }));
  };

  // Step 3 → 4
  const handleRelativesNext = (relatives: DraftRelative[]) => {
    setState((s) => ({ ...s, step: 4, relatives }));
  };

  // Step 4 → 5
  const handleDocumentsNext = (extraFiles: File[]) => {
    setState((s) => ({ ...s, step: 5, extraFiles }));
  };

  const { step, file, parseResult, residentValues, relatives, photo, extraFiles } = state;

  const activeWarnings = parseResult
    ? Object.entries(parseResult.warnings)
        .filter(([key, message]) => message && !dismissedWarnings.has(key))
        .map(([key, message]) => ({ key, message: message as string }))
    : [];

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/import">
            <ArrowLeft size={16} />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Importar ficha de acolhimento</h1>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} steps={STEPS} />

      {/* Import alerts — persist across all steps until dismissed individually */}
      {step > 1 && activeWarnings.length > 0 && (
        <div className="mt-6">
          <ImportWarnings warnings={activeWarnings} onDismiss={dismissWarning} />
        </div>
      )}

      {/* Content */}
      <div className="mt-8">
        {step === 1 && <ImportUploadStep onParsed={handleParsed} />}

        {step === 2 && parseResult && (
          <ImportReviewStep
            parseResult={parseResult}
            initialValues={parseResult.resident}
            photo={photo}
            onPhotoChange={setPhoto}
            onBack={() => setStep(1)}
            onNext={handleResidentNext}
          />
        )}

        {step === 3 && (
          <ImportRelativesStep
            relatives={relatives}
            onBack={() => setStep(2)}
            onNext={handleRelativesNext}
          />
        )}

        {step === 4 && (
          <ImportDocumentsStep
            initialFiles={extraFiles}
            onBack={() => setStep(3)}
            onNext={handleDocumentsNext}
          />
        )}

        {step === 5 && residentValues && file && (
          <ImportSummaryStep
            residentValues={residentValues}
            relatives={relatives}
            houses={houses}
            docxFile={file}
            photo={photo}
            extraFiles={extraFiles}
            onBack={() => setStep(4)}
          />
        )}
      </div>
    </div>
  );
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: { label: string }[] }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-0 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                  done && 'bg-primary border-primary text-primary-foreground',
                  active && 'bg-primary/10 border-primary text-primary',
                  !done && !active && 'bg-background border-muted text-muted-foreground',
                )}
              >
                {done ? '✓' : n}
              </div>
              <span
                className={cn(
                  'text-[10px] text-center leading-tight',
                  active ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-1 mb-4 transition-colors',
                  done ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
