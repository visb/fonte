import { useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { DocumentTemplate } from '@fonte/api-client';
import { useDocumentTemplates, useCreateDocumentTemplate, useDeleteDocumentTemplate } from '../hooks/useDocumentTemplates';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateEditor } from '../components/TemplateEditor';

export function DocumentTemplatesTab() {
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [newName, setNewName] = useState('');

  const { data: templates = [] } = useDocumentTemplates();
  const createMutation = useCreateDocumentTemplate();
  const deleteMutation = useDeleteDocumentTemplate();

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(
      { name, content: '', isRequired: false },
      { onSuccess: () => { setCreateOpen(false); setNewName(''); } },
    );
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
            <span className="font-semibold text-sm truncate">{editing.name}</span>
            {editing.isRequired && (
              <Badge variant="secondary" className="text-xs shrink-0">Acolhimento</Badge>
            )}
          </div>
        </div>
        <TemplateEditor
          key={editing.id}
          template={editing}
          onSaved={(updated) => setEditing(updated)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Templates com badge <strong>Acolhimento</strong> aparecem automaticamente na aba de Anexos do acolhido.
        </p>
        <Button size="sm" onClick={() => { setNewName(''); setCreateOpen(true); }}>
          <Plus size={14} className="mr-1.5" />
          Novo template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState title="Nenhum template cadastrado." />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onSelect={() => setEditing(t)}
              onDelete={() => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
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
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
