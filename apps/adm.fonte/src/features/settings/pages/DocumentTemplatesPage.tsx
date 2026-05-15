import { FileText } from 'lucide-react';
import { DocumentTemplatesTab } from './DocumentTemplatesTab';

export function DocumentTemplatesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold">Templates de documentos</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Edite o conteúdo dos documentos gerados automaticamente no acolhimento. Use as variáveis
        para inserir dados do acolhido.
      </p>
      <DocumentTemplatesTab />
    </div>
  );
}
