import { useRef, useState } from 'react';
import { FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { ParseSpreadsheetResult, SpreadsheetImportRow } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { useParseSpreadsheet } from '../../hooks/useBulkImport';
import { IMPORT_TEXTS } from '../../constants';

interface SpreadsheetUploadStepProps {
  onParsed: (rows: SpreadsheetImportRow[], meta: ParseSpreadsheetResult) => void;
  loaded: ParseSpreadsheetResult | null;
}

export function SpreadsheetUploadStep({ onParsed, loaded }: SpreadsheetUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parse = useParseSpreadsheet();

  const handleFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError(IMPORT_TEXTS.onlyXlsx);
      return;
    }
    parse.mutate(file, {
      onSuccess: (result) => onParsed(result.rows, result),
      onError: (err) => setError(getErrorMessage(err, 'Não foi possível ler a planilha.')),
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (loaded) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
        <CheckCircle2 size={20} className="shrink-0 text-green-600" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-green-800 dark:text-green-200">Planilha carregada</p>
          <p className="text-green-700 dark:text-green-300">
            {loaded.rows.length} filho(s) em {loaded.houses.length} casa(s)
            {loaded.skipped > 0 && ` · ${loaded.skipped} linha(s) ignorada(s)`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Trocar planilha
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer select-none',
          dragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50 hover:bg-muted/30',
          parse.isPending && 'pointer-events-none opacity-60',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !parse.isPending && inputRef.current?.click()}
        role="button"
        aria-label="Área de upload da planilha de referência"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        {parse.isPending ? (
          <>
            <Loader2 size={32} className="text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Lendo a planilha...</p>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <FileSpreadsheet size={28} className="text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Envie a planilha de referência (.xlsx)</p>
              <p className="text-sm text-muted-foreground">Arraste aqui ou clique para selecionar</p>
            </div>
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
