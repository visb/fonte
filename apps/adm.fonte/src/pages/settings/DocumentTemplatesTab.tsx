import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  ImageIcon,
} from "lucide-react";
import { DocumentType } from "@fonte/types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocumentTemplate {
  id: string;
  type: DocumentType;
  content: string;
  updatedAt: string;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  [DocumentType.IMAGE_AUTHORIZATION]: "Termo de Autorização de Uso de Imagem",
  [DocumentType.COMMUNITY_RULES]: "Regras de Permanência na Comunidade",
  [DocumentType.FAMILY_RULES]: "Regras para as Famílias",
};

const VARIABLES: { key: string; label: string; description: string }[] = [
  {
    key: "{{name}}",
    label: "Nome completo",
    description: "Nome completo do acolhido",
  },
  {
    key: "{{cpf}}",
    label: "CPF",
    description: "CPF formatado (000.000.000-00)",
  },
  { key: "{{rg}}", label: "RG", description: "Registro Geral do acolhido" },
  {
    key: "{{birthDate}}",
    label: "Data de nascimento",
    description: "Data de nascimento no formato dd/mm/aaaa",
  },
  {
    key: "{{age}}",
    label: "Idade",
    description: "Idade atual calculada em anos",
  },
  {
    key: "{{maritalStatus}}",
    label: "Estado civil",
    description: "Solteiro(a), Casado(a) ou Divorciado(a)",
  },
  {
    key: "{{address}}",
    label: "Endereço",
    description: "Endereço residencial do acolhido",
  },
  {
    key: "{{phone}}",
    label: "Telefone",
    description: "Telefone de contato do acolhido",
  },
  {
    key: "{{house}}",
    label: "Nome da casa",
    description: "Nome da unidade de acolhimento",
  },
  {
    key: "{{entryDate}}",
    label: "Data de entrada",
    description: "Data de entrada na comunidade (dd/mm/aaaa)",
  },
  {
    key: "{{date}}",
    label: "Data de hoje",
    description: "Data atual no momento da impressão (dd/mm/aaaa)",
  },
];

const ALL_TYPES: DocumentType[] = [
  DocumentType.IMAGE_AUTHORIZATION,
  DocumentType.COMMUNITY_RULES,
  DocumentType.FAMILY_RULES,
];

export function DocumentTemplatesTab() {
  const [activeType, setActiveType] = useState<DocumentType>(
    DocumentType.IMAGE_AUTHORIZATION,
  );

  const { data: templates = [] } = useQuery({
    queryKey: ["document-templates"],
    queryFn: () =>
      api.get<DocumentTemplate[]>("/document-templates").then((r) => r.data),
  });

  const activeTemplate = templates.find((t) => t.type === activeType);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeType === type
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {DOCUMENT_LABELS[type]}
          </button>
        ))}
      </div>

      {activeTemplate && (
        <TemplateEditor key={activeTemplate.type} template={activeTemplate} />
      )}
    </div>
  );
}

function TemplateEditor({ template }: { template: DocumentTemplate }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (content: string) =>
      api.put(`/document-templates/${template.type}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Conteúdo do documento..." }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: template.content,
  });

  useEffect(() => {
    if (editor && template.content && editor.getHTML() !== template.content) {
      editor.commands.setContent(template.content, false);
    }
  }, [editor, template.content]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    mutation.mutate(editor.getHTML());
  }, [editor, mutation]);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor
        .chain()
        .focus()
        .setImage({ src: reader.result as string })
        .run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const insertVariable = (key: string) => {
    if (editor) {
      editor.chain().focus().insertContent(key).run();
    }
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!editor) return null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Título"
        >
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista com marcadores"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <ListOrdered size={14} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        <ToolbarButton
          active={false}
          onClick={() => imageInputRef.current?.click()}
          title="Inserir imagem"
        >
          <ImageIcon size={14} />
        </ToolbarButton>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFile}
        />
      </div>

      {/* Editor area */}
      <div className="min-h-64 rounded-md border bg-background p-4 focus-within:ring-1 focus-within:ring-ring">
        <EditorContent editor={editor} />
      </div>

      {/* Variables panel */}
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
                {copied === key ? "✓ inserido" : key}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <span className="font-medium text-foreground">{label}</span>
                {" — "}
                {description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar template"}
        </Button>
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
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
        "p-1.5 rounded transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
