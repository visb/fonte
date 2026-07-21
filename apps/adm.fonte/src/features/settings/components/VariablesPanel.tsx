import { useState } from 'react';
import { PanelRightClose, Variable, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Variables ────────────────────────────────────────────────────────────────
// Fonte única das variáveis de template no frontend (só apresentação; a
// substituição real acontece no backend). Movida para cá a partir do
// TemplateEditor (story 139) — a barra colapsável é a nova casa da lista e será
// a fonte de arraste na story 140.

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
}

export const VARIABLES: TemplateVariable[] = [
  { key: '{{name}}',          label: 'Nome completo',      description: 'Nome completo do acolhido' },
  { key: '{{cpf}}',           label: 'CPF',                description: 'CPF formatado (000.000.000-00)' },
  { key: '{{rg}}',            label: 'RG',                 description: 'Registro Geral do acolhido' },
  { key: '{{nationality}}',   label: 'Nacionalidade',      description: 'Nacionalidade do acolhido' },
  { key: '{{city}}',          label: 'Cidade',             description: 'Cidade de residência do acolhido' },
  { key: '{{state}}',         label: 'UF',                 description: 'Estado (sigla) de residência do acolhido' },
  { key: '{{birthDate}}',     label: 'Data de nascimento', description: 'Data de nascimento no formato dd/mm/aaaa' },
  { key: '{{age}}',           label: 'Idade',              description: 'Idade atual calculada em anos' },
  { key: '{{maritalStatus}}', label: 'Estado civil',       description: 'Solteiro(a), Casado(a) ou Divorciado(a)' },
  { key: '{{address}}',       label: 'Endereço',           description: 'Endereço residencial do acolhido' },
  { key: '{{phone}}',         label: 'Telefone',           description: 'Telefone de contato do acolhido' },
  { key: '{{house}}',         label: 'Nome da casa',       description: 'Nome da unidade de acolhimento' },
  { key: '{{houseName}}',     label: 'Casa — nome',        description: 'Nome da casa onde o acolhido está' },
  { key: '{{houseAddress}}',  label: 'Casa — endereço',    description: 'Endereço da casa onde o acolhido está' },
  { key: '{{houseCity}}',     label: 'Casa — cidade',      description: 'Cidade da casa onde o acolhido está' },
  { key: '{{houseState}}',    label: 'Casa — UF',          description: 'Estado (sigla) da casa onde o acolhido está' },
  { key: '{{entryDate}}',     label: 'Data de entrada',    description: 'Data de entrada na comunidade (dd/mm/aaaa)' },
  { key: '{{date}}',          label: 'Data de hoje',       description: 'Data atual no momento da impressão (dd/mm/aaaa)' },
  { key: '{{dateLong}}',      label: 'Data por extenso',   description: 'Data atual por extenso (ex: 1 de junho de 2026)' },
  { key: '{{responsibleName}}',         label: 'Responsável — nome',       description: 'Nome do familiar marcado como responsável' },
  { key: '{{responsibleRelationship}}', label: 'Responsável — parentesco', description: 'Parentesco do responsável com o acolhido' },
  { key: '{{responsiblePhone}}',        label: 'Responsável — telefone',   description: 'Telefone do familiar responsável' },
  { key: '{{signature}}',               label: 'Assinatura',               description: 'Assinatura do usuário que gerar o documento' },
];

const FEEDBACK_MS = 1500;

interface Props {
  /** Insere a variável no editor (no cursor). O clipboard + feedback são deste painel. */
  onInsert: (key: string) => void;
}

// ─── VariablesPanel ─────────────────────────────────────────────────────────
// Barra vertical colapsável fixa à direita (story 139). Default recolhido: só a
// aba "Variáveis" na borda. Ao expandir, lista rolável com uma variável por
// linha (rótulo + chave). Clicar insere no editor + copia pro clipboard + mostra
// feedback "inserido" por ~1,5s. `z-40`: acima do conteúdo/toolbar sticky (z-20)
// e abaixo dos dialogs do Radix (z-50).

export function VariablesPanel({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleInsert = (key: string) => {
    onInsert(key);
    // Clipboard é conveniência; ausente no jsdom/testes → guardado por `?.`.
    navigator.clipboard?.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), FEEDBACK_MS);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Mostrar variáveis disponíveis"
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1.5 rounded-l-md border border-r-0 bg-primary px-1.5 py-3 text-xs font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 [writing-mode:vertical-rl]"
      >
        <Variable size={14} className="rotate-90" />
        Variáveis
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-56 max-w-[80vw] flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Variable size={13} />
          Variáveis
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Recolher variáveis"
          aria-label="Recolher variáveis"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PanelRightClose size={15} />
        </button>
      </div>

      <p className="px-3 pt-2 text-[11px] leading-tight text-muted-foreground">
        Clique para inserir no editor.
      </p>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {VARIABLES.map(({ key, label, description }) => (
          <button
            key={key}
            type="button"
            title={description}
            onClick={() => handleInsert(key)}
            className={cn(
              'group flex w-full flex-col items-start gap-0.5 rounded border bg-background px-2 py-1.5 text-left transition-colors hover:bg-accent',
            )}
          >
            <span className="text-xs font-medium leading-tight text-foreground">{label}</span>
            <span className="font-mono text-[11px] leading-tight text-primary group-hover:underline">
              {copied === key ? (
                <span className="not-italic text-green-600">✓ inserido</span>
              ) : (
                key
              )}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        title="Recolher variáveis"
        className="flex items-center justify-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X size={13} />
        Recolher
      </button>
    </aside>
  );
}
