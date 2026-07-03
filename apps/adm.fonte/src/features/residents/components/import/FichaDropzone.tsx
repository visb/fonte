import { useRef, useState } from 'react';
import { FileText, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IMPORT_TEXTS } from '../../constants';

interface FichaDropzoneProps {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}

/** Filtra apenas `.docx`; devolve os aceitos e se algum foi rejeitado. */
function filterDocx(files: File[]): { accepted: File[]; rejected: boolean } {
  const accepted = files.filter((file) => file.name.toLowerCase().endsWith('.docx'));
  return { accepted, rejected: accepted.length < files.length };
}

export function FichaDropzone({ disabled, onFiles }: FichaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setError(null);
    const { accepted, rejected } = filterDocx(Array.from(fileList));
    if (rejected) setError(IMPORT_TEXTS.onlyDocx);
    if (accepted.length > 0) onFiles(accepted);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors select-none',
          disabled
            ? 'cursor-not-allowed border-muted bg-muted/30 opacity-60'
            : 'cursor-pointer',
          !disabled && (dragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50 hover:bg-muted/30'),
        )}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        aria-disabled={disabled}
        aria-label="Área de upload das fichas DOCX"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <FileText size={28} className="text-primary" />
        </div>
        {disabled ? (
          <p className="text-sm text-muted-foreground">{IMPORT_TEXTS.fichaDisabled}</p>
        ) : (
          <>
            <div className="space-y-1">
              <p className="font-medium">Arraste as fichas .docx</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar (várias de uma vez)</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2 pointer-events-none">
              <Upload size={14} />
              Selecionar .docx
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
