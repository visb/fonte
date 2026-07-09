import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ParseSpreadsheetResult, SpreadsheetImportRow } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { SpreadsheetUploadStep } from '../components/import/SpreadsheetUploadStep';
import { FichaDropzone } from '../components/import/FichaDropzone';
import { ImportQueue } from '../components/import/ImportQueue';
import { ImportFichaModal } from '../components/import/ImportFichaModal';
import { useImportQueue, type ImportQueueItem } from '../hooks/useBulkImport';

export function BulkImportPage() {
  const [rows, setRows] = useState<SpreadsheetImportRow[]>([]);
  const [meta, setMeta] = useState<ParseSpreadsheetResult | null>(null);
  const [modalItem, setModalItem] = useState<ImportQueueItem | null>(null);
  const {
    items,
    addFiles,
    removeItem,
    restoreItem,
    markImported,
    sessionConflictName,
    pendingCount,
    tabCounts,
  } = useImportQueue(rows);

  const handleParsed = (parsedRows: SpreadsheetImportRow[], result: ParseSpreadsheetResult) => {
    setRows(parsedRows);
    setMeta(result);
  };

  const handleApproved = (id: string) => {
    markImported(id);
    setModalItem(null);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/import">
            <ArrowLeft size={16} />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Importar filhos em lote</h1>
      </div>

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">1. Planilha de referência</h2>
          <SpreadsheetUploadStep onParsed={handleParsed} loaded={meta} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">2. Fichas de acolhimento (.docx)</h2>
          <FichaDropzone disabled={meta === null} onFiles={addFiles} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            3. Fila de importação{pendingCount > 0 ? ` (${pendingCount} pendente${pendingCount > 1 ? 's' : ''})` : ''}
          </h2>
          <ImportQueue
            items={items}
            onRemove={removeItem}
            onRestore={restoreItem}
            onViewFicha={setModalItem}
            onImported={markImported}
            sessionConflictName={sessionConflictName}
            tabCounts={tabCounts}
          />
        </section>
      </div>

      {modalItem && (
        <ImportFichaModal
          item={modalItem}
          open
          onClose={() => setModalItem(null)}
          onApproved={handleApproved}
          sessionConflictName={sessionConflictName(modalItem)}
        />
      )}
    </div>
  );
}
