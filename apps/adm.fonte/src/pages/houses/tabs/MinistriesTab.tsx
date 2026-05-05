import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface HouseMinistryItem {
  id: string;
  ministryId: string;
  ministryName: string;
  leaderId: string | null;
  leaderName: string | null;
}

interface Ministry {
  id: string;
  name: string;
}

interface StaffItem {
  id: string;
  name: string;
}

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function MinistriesTab({ houseId }: { houseId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HouseMinistryItem | null>(null);
  const [removeTarget, setRemoveTarget] = useState<HouseMinistryItem | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState("");

  const { data: houseMinistries = [], isLoading } = useQuery({
    queryKey: ["houses", houseId, "ministries"],
    queryFn: () =>
      api
        .get<HouseMinistryItem[]>(`/houses/${houseId}/ministries`)
        .then((r) => r.data),
  });

  const { data: allMinistries = [] } = useQuery({
    queryKey: ["ministries"],
    queryFn: () =>
      api.get<Ministry[]>("/ministries").then((r) => r.data),
    enabled: addOpen,
  });

  const { data: houseStaff = [] } = useQuery({
    queryKey: ["houses", houseId, "staff"],
    queryFn: () =>
      api.get<StaffItem[]>(`/houses/${houseId}/staff`).then((r) => r.data),
    enabled: addOpen || !!editTarget,
  });

  const addMutation = useMutation({
    mutationFn: (data: { ministryId: string; leaderId?: string }) =>
      api.post(`/houses/${houseId}/ministries`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses", houseId, "ministries"] });
      setAddOpen(false);
      setSelectedMinistryId("");
      setSelectedLeaderId("");
    },
  });

  const updateLeaderMutation = useMutation({
    mutationFn: ({ hmId, leaderId }: { hmId: string; leaderId: string | null }) =>
      api
        .patch(`/houses/${houseId}/ministries/${hmId}`, { leaderId })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses", houseId, "ministries"] });
      setEditTarget(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (hmId: string) =>
      api.delete(`/houses/${houseId}/ministries/${hmId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses", houseId, "ministries"] });
      setRemoveTarget(null);
    },
  });

  const addedIds = new Set(houseMinistries.map((hm) => hm.ministryId));
  const availableMinistries = allMinistries.filter((m) => !addedIds.has(m.id));

  const handleAdd = () => {
    if (!selectedMinistryId) return;
    addMutation.mutate({
      ministryId: selectedMinistryId,
      leaderId: selectedLeaderId || undefined,
    });
  };

  const handleUpdateLeader = () => {
    if (!editTarget) return;
    updateLeaderMutation.mutate({
      hmId: editTarget.id,
      leaderId: selectedLeaderId || null,
    });
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-2" />
            Adicionar ministério
          </Button>
        </div>

        {houseMinistries.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhum ministério associado a esta casa.
          </p>
        ) : (
          <div className="space-y-2">
            {houseMinistries.map((hm) => (
              <div
                key={hm.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium text-sm">{hm.ministryName}</p>
                  <p className="text-xs text-muted-foreground">
                    Líder: {hm.leaderName ?? "Não definido"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Editar líder"
                    onClick={() => {
                      setEditTarget(hm);
                      setSelectedLeaderId(hm.leaderId ?? "");
                    }}
                  >
                    <Pencil size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Remover ministério"
                    onClick={() => setRemoveTarget(hm)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && setAddOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Ministério</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Ministério *</Label>
              <select
                value={selectedMinistryId}
                onChange={(e) => setSelectedMinistryId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Selecionar...</option>
                {availableMinistries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {availableMinistries.length === 0 && allMinistries.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Todos os ministérios já foram adicionados.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Líder (opcional)</Label>
              <select
                value={selectedLeaderId}
                onChange={(e) => setSelectedLeaderId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Sem líder</option>
                {houseStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedMinistryId || addMutation.isPending}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Leader Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Líder — {editTarget?.ministryName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Líder</Label>
            <select
              value={selectedLeaderId}
              onChange={(e) => setSelectedLeaderId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Sem líder</option>
              {houseStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateLeader}
              disabled={updateLeaderMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ministério</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o ministério{" "}
              <strong>{removeTarget?.ministryName}</strong> desta casa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
