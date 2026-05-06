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
  Plus,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { DocumentTemplate } from '@fonte/api-client';

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

export function DocumentTemplatesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(
    null,
  );
  const [newName, setNewName] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["document-templates"],
    queryFn: () => api.documentTemplates.list(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.documentTemplates.create({ name, content: "", isRequired: false }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      setCreateOpen(false);
      setNewName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.documentTemplates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      if (editing && deleteTarget && editing.id === deleteTarget.id)
        setEditing(null);
      setDeleteTarget(null);
    },
  });

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            <ChevronLeft size={16} className="mr-1" />
            Voltar
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-sm truncate">
              {editing.name}
            </span>
            {editing.isRequired && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Acolhimento
              </Badge>
            )}
          </div>
        </div>
        <TemplateEditor
          key={editing.id}
          template={editing}
          onSaved={(updated) => {
            setEditing(updated);
            queryClient.invalidateQueries({ queryKey: ["document-templates"] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Templates com badge <strong>Acolhimento</strong> aparecem
          automaticamente na aba de Anexos do acolhido.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setNewName("");
            setCreateOpen(true);
          }}
        >
          <Plus size={14} className="mr-1.5" />
          Novo template
        </Button>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum template cadastrado.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setEditing(t)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{t.name}</span>
                  {t.isRequired && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      Acolhimento
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Atualizado em{" "}
                  {new Date(t.updatedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(t);
                }}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dialog: novo template */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="new-template-name">Nome do documento</Label>
            <Input
              id="new-template-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Termo de Confidencialidade"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: deletar template */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateEditor({
  template,
  onSaved,
}: {
  template: DocumentTemplate;
  onSaved: (updated: DocumentTemplate) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [name, setName] = useState(template.name);
  const [isRequired, setIsRequired] = useState(template.isRequired);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (data: { name: string; content: string; isRequired: boolean }) =>
      api.documentTemplates.update(template.id, data),
    onSuccess: (updated) => onSaved(updated),
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
      editor.commands.setContent(template.content);
    }
  }, [editor, template.content]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    mutation.mutate({ name, content: editor.getHTML(), isRequired });
  }, [editor, mutation, name, isRequired]);

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
    if (editor) editor.chain().focus().insertContent(key).run();
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!editor) return null;

  return (
    <div className="space-y-3">
      {/* Nome e flag de acolhimento */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label htmlFor="template-name" className="text-xs mb-1 block">
            Nome do template
          </Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            id="is-required"
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="h-4 w-4 cursor-pointer"
          />
          <Label
            htmlFor="is-required"
            className="text-sm cursor-pointer whitespace-nowrap"
          >
            Exigir no acolhimento
          </Label>
        </div>
      </div>

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
        <Button
          onClick={handleSave}
          disabled={mutation.isPending || !name.trim()}
        >
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
