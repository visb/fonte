import { useEffect, useRef, useState } from "react";
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
  leaderType: "STAFF" | "RESIDENT" | null;
  leaderName: string | null;
}

interface Ministry {
  id: string;
  name: string;
}

interface PersonItem {
  id: string;
  name: string;
}

interface LeaderOption {
  id: string;
  name: string;
  type: "STAFF" | "RESIDENT";
}

interface SelectedLeader {
  id: string;
  type: "STAFF" | "RESIDENT";
}

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function LeaderAutocomplete({
  selectedId,
  selectedType,
  onSelect,
  staff,
  residents,
}: {
  selectedId: string | null;
  selectedType: "STAFF" | "RESIDENT" | null;
  onSelect: (id: string | null, type: "STAFF" | "RESIDENT" | null) => void;
  staff: PersonItem[];
  residents: PersonItem[];
}) {
  const allOptions: LeaderOption[] = [
    ...staff.map((s) => ({ id: s.id, name: s.name, type: "STAFF" as const })),
    ...residents.map((r) => ({ id: r.id, name: r.name, type: "RESIDENT" as const })),
  ];

  const selectedName =
    selectedId && selectedType
      ? (allOptions.find((o) => o.id === selectedId && o.type === selectedType)?.name ?? "")
      : "";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query
    ? allOptions.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : allOptions;

  const handleSelect = (id: string | null, type: "STAFF" | "RESIDENT" | null) => {
    onSelect(id, type);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`${SELECT_CLASS} cursor-pointer`}
        onClick={() => setOpen(true)}
      >
        {open ? (
          <input
            autoFocus
            className="w-full outline-none bg-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={selectedName ? "" : "text-muted-foreground"}>
            {selectedName || "Sem líder"}
          </span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              className="w-full px-3 py-1.5 text-sm text-left text-muted-foreground hover:bg-accent"
              onMouseDown={() => handleSelect(null, null)}
            >
              Sem líder
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</p>
            )}
            {filtered.map((o) => (
              <button
                key={`${o.type}-${o.id}`}
                type="button"
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-accent"
                onMouseDown={() => handleSelect(o.id, o.type)}
              >
                <span>{o.name}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    o.type === "STAFF"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {o.type === "STAFF" ? "Servo" : "Filho"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MinistriesTab({ houseId }: { houseId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HouseMinistryItem | null>(null);
  const [removeTarget, setRemoveTarget] = useState<HouseMinistryItem | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState("");
  const [selectedLeader, setSelectedLeader] = useState<SelectedLeader | null>(null);

  const { data: houseMinistries = [], isLoading } = useQuery({
    queryKey: ["houses", houseId, "ministries"],
    queryFn: () =>
      api
        .get<HouseMinistryItem[]>(`/houses/${houseId}/ministries`)
        .then((r) => r.data),
  });

  const { data: allMinistries = [] } = useQuery({
    queryKey: ["ministries"],
    queryFn: () => api.get<Ministry[]>("/ministries").then((r) => r.data),
    enabled: addOpen,
  });

  const { data: houseStaff = [] } = useQuery({
    queryKey: ["houses", houseId, "staff"],
    queryFn: () =>
      api.get<PersonItem[]>(`/houses/${houseId}/staff`).then((r) => r.data),
    enabled: addOpen || !!editTarget,
  });

  const { data: houseResidents = [] } = useQuery({
    queryKey: ["houses", houseId, "residents"],
    queryFn: () =>
      api.get<PersonItem[]>(`/houses/${houseId}/residents`).then((r) => r.data),
    enabled: addOpen || !!editTarget,
  });

  const addMutation = useMutation({
    mutationFn: (data: { ministryId: string; leaderId?: string; leaderType?: "STAFF" | "RESIDENT" }) =>
      api.post(`/houses/${houseId}/ministries`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses", houseId, "ministries"] });
      setAddOpen(false);
      setSelectedMinistryId("");
      setSelectedLeader(null);
    },
  });

  const updateLeaderMutation = useMutation({
    mutationFn: ({
      hmId,
      leaderId,
      leaderType,
    }: {
      hmId: string;
      leaderId: string | null;
      leaderType: "STAFF" | "RESIDENT" | null;
    }) =>
      api
        .patch(`/houses/${houseId}/ministries/${hmId}`, { leaderId, leaderType })
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
      leaderId: selectedLeader?.id || undefined,
      leaderType: selectedLeader?.type || undefined,
    });
  };

  const handleUpdateLeader = () => {
    if (!editTarget) return;
    updateLeaderMutation.mutate({
      hmId: editTarget.id,
      leaderId: selectedLeader?.id ?? null,
      leaderType: selectedLeader?.type ?? null,
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
                    Responsável: {hm.leaderName ?? "Não definido"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Editar responsável"
                    onClick={() => {
                      setEditTarget(hm);
                      setSelectedLeader(
                        hm.leaderId && hm.leaderType
                          ? { id: hm.leaderId, type: hm.leaderType }
                          : null,
                      );
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
            <DialogTitle>Adicionar Setor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Setor *</Label>
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
              <Label>Responsável (opcional)</Label>
              <LeaderAutocomplete
                selectedId={selectedLeader?.id ?? null}
                selectedType={selectedLeader?.type ?? null}
                onSelect={(id, type) =>
                  setSelectedLeader(id && type ? { id, type } : null)
                }
                staff={houseStaff}
                residents={houseResidents}
              />
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
            <DialogTitle>Editar Responsável — {editTarget?.ministryName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Responsável</Label>
            <LeaderAutocomplete
              selectedId={selectedLeader?.id ?? null}
              selectedType={selectedLeader?.type ?? null}
              onSelect={(id, type) =>
                setSelectedLeader(id && type ? { id, type } : null)
              }
              staff={houseStaff}
              residents={houseResidents}
            />
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
