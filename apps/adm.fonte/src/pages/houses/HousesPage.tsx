import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Home, MapPin, Pencil, Phone, Plus, Trash2, User } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const API_ORIGIN =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(
    "/api/v1",
    "",
  ) ?? "http://localhost:3000";

const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

interface Staff {
  id: string;
  name: string;
  houseId: string;
}

interface House {
  id: string;
  name: string;
  generalCapacity: number | null;
  staffCapacity: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  coordinatorId: string | null;
  coordinator: Staff | null;
  phone: string | null;
  thumbnailUrl: string | null;
  activeResidentsCount: number;
  staffCount: number;
  createdAt: string;
  updatedAt: string;
}

const houseSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  generalCapacity: z.coerce.number().int().min(1).optional().or(z.literal("")),
  staffCapacity: z.coerce.number().int().min(1).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().length(2).optional().or(z.literal("")),
  coordinatorId: z.string().uuid().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});
type HouseFormData = z.infer<typeof houseSchema>;

const fetchHouses = () => api.get<House[]>("/houses").then((r) => r.data);
const fetchStaff = () => api.get<Staff[]>("/staff").then((r) => r.data);
const createHouse = (data: HouseFormData) =>
  api.post<House>("/houses", sanitize(data)).then((r) => r.data);
const updateHouse = ({ id, ...data }: { id: string } & HouseFormData) =>
  api.patch<House>(`/houses/${id}`, sanitize(data)).then((r) => r.data);
const deleteHouse = (id: string) => api.delete(`/houses/${id}`);

function sanitize(data: HouseFormData) {
  return {
    ...data,
    generalCapacity:
      data.generalCapacity === "" || data.generalCapacity === undefined
        ? null
        : data.generalCapacity,
    staffCapacity:
      data.staffCapacity === "" || data.staffCapacity === undefined
        ? null
        : data.staffCapacity,
    address: data.address === "" ? null : data.address,
    city: data.city === "" ? null : data.city,
    state: data.state === "" ? null : data.state,
    coordinatorId: data.coordinatorId === "" ? null : data.coordinatorId,
    phone: data.phone === "" ? null : data.phone,
  };
}

export function HousesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HouseFormData>({ resolver: zodResolver(houseSchema) });

  const {
    data: houses = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["houses"],
    queryFn: fetchHouses,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: fetchStaff,
    enabled: dialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: createHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses"] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses"] });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditingHouse(null);
    reset({
      name: "",
      generalCapacity: "",
      staffCapacity: "",
      address: "",
      city: "",
      state: "",
      coordinatorId: "",
      phone: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (house: House) => {
    setEditingHouse(house);
    reset({
      name: house.name,
      generalCapacity: house.generalCapacity ?? "",
      staffCapacity: house.staffCapacity ?? "",
      address: house.address ?? "",
      city: house.city ?? "",
      state: house.state ?? "",
      coordinatorId: house.coordinatorId ?? "",
      phone: house.phone ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingHouse(null);
    reset({
      name: "",
      generalCapacity: "",
      staffCapacity: "",
      address: "",
      city: "",
      state: "",
      coordinatorId: "",
      phone: "",
    });
  };

  const onSubmit = (data: HouseFormData) => {
    if (editingHouse) {
      updateMutation.mutate({ id: editingHouse.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (isError)
    return <p className="text-destructive">Erro ao carregar casas.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Casas</h1>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" />
          Nova Casa
        </Button>
      </div>

      {houses.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Nenhuma casa cadastrada.
        </p>
      ) : (
        <div className="space-y-3">
          {houses.map((house) => (
            <div
              key={house.id}
              className="flex w-full overflow-hidden rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/houses/${house.id}`)}
            >
              <div className="w-36 shrink-0 bg-muted">
                {house.thumbnailUrl ? (
                  <img
                    src={`${API_ORIGIN}${house.thumbnailUrl}`}
                    alt={house.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Home size={28} />
                  </div>
                )}
              </div>

              <div className="flex flex-1 items-center gap-6 px-5 py-4 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">
                    {house.name}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    {(house.city || house.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {[house.city, house.state].filter(Boolean).join(" — ")}
                      </span>
                    )}
                    {house.coordinator && (
                      <span className="flex items-center gap-1">
                        <User size={13} />
                        {house.coordinator.name}
                      </span>
                    )}
                    {house.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} />
                        {house.phone}
                      </span>
                    )}
                  </div>
                </div>

                {(house.generalCapacity != null ||
                  house.staffCapacity != null) && (
                  <div className="flex gap-4 shrink-0 text-center">
                    <div>
                      <p className="text-xl font-bold leading-none">
                        {Math.max(
                          0,
                          (house.generalCapacity ?? 0) +
                            (house.staffCapacity ?? 0) -
                            house.staffCount -
                            house.activeResidentsCount,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        vagas
                      </p>
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none">
                        {house.activeResidentsCount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        filhos
                      </p>
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none">
                        {house.staffCount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        servos
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className="flex gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(house)}
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(house)}
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingHouse ? "Editar Casa" : "Nova Casa"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Ex: Casa da Paz"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="generalCapacity">Cap. filhos</Label>
                  <Input
                    id="generalCapacity"
                    type="number"
                    min={1}
                    {...register("generalCapacity")}
                    placeholder="Ex: 15"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffCapacity">Cap. servos</Label>
                  <Input
                    id="staffCapacity"
                    type="number"
                    min={1}
                    {...register("staffCapacity")}
                    placeholder="Ex: 5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  {...register("address")}
                  placeholder="Ex: Rua das Flores, 123"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    {...register("city")}
                    placeholder="Ex: São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <select
                    id="state"
                    {...register("state")}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">—</option>
                    {BR_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coordinatorId">Coordenador</Label>
                <select
                  id="coordinatorId"
                  {...register("coordinatorId")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Sem coordenador</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {editingHouse ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Casa</AlertDialogTitle>
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
