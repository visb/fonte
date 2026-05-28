import { useRef, useState } from 'react';
import { FileText, Upload, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { ParseResult } from '../../lib/types';

interface ImportUploadStepProps {
  onParsed: (result: ParseResult, file: File) => void;
}

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function ImportUploadStep({ onParsed }: ImportUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!file.name.endsWith('.docx')) {
      setError('Apenas arquivos .docx são aceitos.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Arquivo muito grande. Máximo ${MAX_SIZE_MB} MB.`);
      return;
    }

    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const raw = await api.residents.parseDocx(fd);
      const result: ParseResult = {
        resident: raw.resident as ParseResult['resident'],
        relatives: (raw.relatives ?? []).map((r) => ({
          ...r,
          id: crypto.randomUUID(),
          include: true,
        })),
        warnings: raw.warnings as ParseResult['warnings'],
        houseName: raw.houseName,
        rawText: raw.rawText,
      };
      onParsed(result, file);
    } catch (e) {
      setError('Não foi possível extrair os dados. Verifique se é um .docx válido e tente novamente.');
      console.error(e);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Importar ficha de acolhimento</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Envie o arquivo <strong>.docx</strong> da ficha preenchida. Os dados serão extraídos
          automaticamente para revisão antes de salvar.
        </p>
      </div>

      <div
        className={cn(
          'w-full max-w-md border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 transition-colors cursor-pointer select-none',
          dragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50 hover:bg-muted/30',
          parsing && 'pointer-events-none opacity-60',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !parsing && inputRef.current?.click()}
        role="button"
        aria-label="Área de upload do arquivo DOCX"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={handleChange}
        />

        {parsing ? (
          <>
            <Loader2 size={40} className="text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Extraindo dados com IA...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText size={32} className="text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Arraste o arquivo aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2 pointer-events-none">
              <Upload size={14} />
              Selecionar .docx
            </Button>
            <p className="text-xs text-muted-foreground">Máximo {MAX_SIZE_MB} MB</p>
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
