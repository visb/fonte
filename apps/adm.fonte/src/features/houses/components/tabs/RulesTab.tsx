import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import type { HouseRule } from '@fonte/api-client';

export function RulesTab({ houseId }: { houseId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<HouseRule | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data: rules = [], isLoading } = useQuery({
    queryKey: queryKeys.houses.rules(houseId),
    queryFn: () => api.houses.listRules(houseId),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string }) => api.houses.createRule(houseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.rules(houseId) });
      setAddOpen(false);
      setTitle('');
      setContent('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (ruleId: string) => api.houses.deleteRule(houseId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.rules(houseId) });
      setRemoveTarget(null);
    },
  });

  if (isLoading) return <LoadingState />;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-2" />
            Nova regra
          </Button>
        </div>

        {rules.length === 0 ? (
          <EmptyState title="Nenhuma regra cadastrada." />
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm">{rule.title}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" title="Remover regra" onClick={() => setRemoveTarget(rule)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => !open && setAddOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Regra</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rule-title">Título *</Label>
              <Input id="rule-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Horário de recolher" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-content">Conteúdo *</Label>
              <Textarea id="rule-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Descreva a regra em detalhe..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate({ title, content })} disabled={!title.trim() || !content.trim() || createMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover a regra <strong>"{removeTarget?.title}"</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
