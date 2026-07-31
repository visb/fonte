import { DocumentCard } from './DocumentCard';
import type { DocumentTemplate, ResidentDocument } from '@fonte/api-client';

interface Props {
  templates: DocumentTemplate[];
  residentId: string;
  residentName: string;
  docByTemplate: Record<string, ResidentDocument>;
  generatingId: string | null;
  onGenerate: (template: DocumentTemplate) => void;
  selectedIds: Set<string>;
  onToggleSelect: (templateId: string) => void;
}

// Lista de cards de template de um grupo (obrigatórios ou assinatura no
// acolhimento). A ordem renderizada aqui é a ordem do PDF combinado.
export function DocumentCardList({
  templates, residentId, residentName, docByTemplate, generatingId, onGenerate, selectedIds, onToggleSelect,
}: Props) {
  return (
    <>
      {templates.map((template) => (
        <DocumentCard
          key={template.id}
          template={template}
          residentId={residentId}
          residentName={residentName}
          signedDoc={docByTemplate[template.id] ?? null}
          onGenerate={onGenerate}
          generating={generatingId === template.id}
          selected={selectedIds.has(template.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </>
  );
}
