import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import {
  Bold, Heading2, ImageIcon, Italic, List, ListOrdered,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { DocumentTemplate } from '@fonte/api-client';
import { useUpdateDocumentTemplate } from '../hooks/useDocumentTemplates';

const VARIABLES: { key: string; label: string; description: string }[] = [
  { key: '{{name}}', label: 'Nome completo', description: 'Nome completo do acolhido' },
  { key: '{{cpf}}', label: 'CPF', description: 'CPF formatado (000.000.000-00)' },
  { key: '{{rg}}', label: 'RG', description: 'Registro Geral do acolhido' },
  { key: '{{birthDate}}', label: 'Data de nascimento', description: 'Data de nascimento no formato dd/mm/aaaa' },
  { key: '{{age}}', label: 'Idade', description: 'Idade atual calculada em anos' },
  { key: '{{maritalStatus}}', label: 'Estado civil', description: 'Solteiro(a), Casado(a) ou Divorciado(a)' },
  { key: '{{address}}', label: 'Endereço', description: 'Endereço residencial do acolhido' },
  { key: '{{phone}}', label: 'Telefone', description: 'Telefone de contato do acolhido' },
  { key: '{{house}}', label: 'Nome da casa', description: 'Nome da unidade de acolhimento' },
  { key: '{{entryDate}}', label: 'Data de entrada', description: 'Data de entrada na comunidade (dd/mm/aaaa)' },
  { key: '{{date}}', label: 'Data de hoje', description: 'Data atual no momento da impressão (dd/mm/aaaa)' },
];

function ToolbarButton({
  active, onClick, title, children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

const schema = z.object({
  name: z.string().min(1),
  isRequired: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  template: DocumentTemplate;
  onSaved: (updated: DocumentTemplate) => void;
}

export function TemplateEditor({ template, onSaved }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { register, getValues, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: template.name, isRequired: template.isRequired },
  });

  useEffect(() => {
    reset({ name: template.name, isRequired: template.isRequired });
  }, [template.id, reset]);

  const updateMutation = useUpdateDocumentTemplate();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Conteúdo do documento...' }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: template.content,
  });

  useEffect(() => {
    if (editor && template.content && editor.getHTML() !== template.content) {
      editor.commands.setContent(template.content);
    }
  }, [editor, template.content]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    const { name, isRequired } = getValues();
    updateMutation.mutate(
      { id: template.id, data: { name, content: editor.getHTML(), isRequired } },
      { onSuccess: (updated) => onSaved(updated) },
    );
  }, [editor, updateMutation, template.id, getValues, onSaved]);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertVariable = (key: string) => {
    if (editor) editor.chain().focus().insertContent(key).run();
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!editor) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label htmlFor="template-name" className="text-xs mb-1 block">Nome do template</Label>
          <Input id="template-name" {...register('name')} className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input id="is-required" type="checkbox" {...register('isRequired')} className="h-4 w-4 cursor-pointer" />
          <Label htmlFor="is-required" className="text-sm cursor-pointer whitespace-nowrap">
            Exigir no acolhimento
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título">
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com marcadores">
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered size={14} />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-0.5" />
        <ToolbarButton active={false} onClick={() => imageInputRef.current?.click()} title="Inserir imagem">
          <ImageIcon size={14} />
        </ToolbarButton>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      </div>

      <div className="min-h-64 rounded-md border bg-background p-4 focus-within:ring-1 focus-within:ring-ring">
        <EditorContent editor={editor} />
      </div>

      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Variáveis disponíveis — clique para inserir no editor
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {VARIABLES.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => insertVariable(key)}
              className="flex items-start gap-2 rounded px-2 py-1.5 text-left bg-background border hover:bg-accent transition-colors group"
            >
              <span className="font-mono text-xs text-primary shrink-0 mt-0.5 group-hover:underline">
                {copied === key ? '✓ inserido' : key}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <span className="font-medium text-foreground">{label}</span>
                {' — '}
                {description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || !getValues('name').trim()}>
          {updateMutation.isPending ? 'Salvando...' : 'Salvar template'}
        </Button>
      </div>
    </div>
  );
}
