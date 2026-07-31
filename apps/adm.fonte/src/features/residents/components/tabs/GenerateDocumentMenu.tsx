import { ChevronDown, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentTemplate } from '@fonte/api-client';

interface Props {
  templates: DocumentTemplate[];
  onGenerate: (template: DocumentTemplate) => void;
  generatingId: string | null;
}

// Templates opcionais: não têm card (logo, não entram no PDF combinado — decisão
// 5 da story 152), só o download individual por este menu.
export function GenerateDocumentMenu({ templates, onGenerate, generatingId }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={generatingId !== null}>
          {generatingId !== null
            ? <Loader2 size={14} className="animate-spin mr-1.5" />
            : <FileText size={14} className="mr-1.5" />}
          Gerar documento
          <ChevronDown size={14} className="ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => onGenerate(t)}>{t.name}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
