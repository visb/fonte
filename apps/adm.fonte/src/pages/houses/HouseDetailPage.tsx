import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const optionalCapacity = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
  z.number().int().min(1).optional(),
);

const houseSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  generalCapacity: optionalCapacity,
  staffCapacity: optionalCapacity,
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().length(2).optional().or(z.literal("")),
  coordinatorId: z.string().uuid().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});
type HouseFormData = z.infer<typeof houseSchema>;

function sanitize(data: HouseFormData) {
  return {
    ...data,
    generalCapacity:
      data.generalCapacity === undefined ? null : data.generalCapacity,
    staffCapacity: data.staffCapacity === undefined ? null : data.staffCapacity,
    address: data.address === "" ? null : data.address,
    city: data.city === "" ? null : data.city,
    state: data.state === "" ? null : data.state,
    coordinatorId: data.coordinatorId === "" ? null : data.coordinatorId,
    phone: data.phone === "" ? null : data.phone,
  };
}

interface StaffItem {
  id: string;
  name: string;
  houseId: string;
}

interface HousePhoto {
  id: string;
  filename: string;
  url: string;
  createdAt: string;
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
  coordinator: { id: string; name: string; phone: string | null } | null;
  phone: string | null;
  photos: HousePhoto[];
  activeResidentsCount: number;
  staffCount: number;
}

const fetchHouse = (id: string) =>
  api.get<House>(`/houses/${id}`).then((r) => r.data);

const fetchStaff = () => api.get<StaffItem[]>("/staff").then((r) => r.data);

const uploadPhoto = ({ id, file }: { id: string; file: File }) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<HousePhoto>(`/houses/${id}/photos`, form, {
      headers: { "Content-Type": undefined },
    })
    .then((r) => r.data);
};

const deletePhoto = ({
  houseId,
  photoId,
}: {
  houseId: string;
  photoId: string;
}) => api.delete(`/houses/${houseId}/photos/${photoId}`);

const updateHouse = ({ id, ...data }: { id: string } & HouseFormData) =>
  api.patch<House>(`/houses/${id}`, sanitize(data)).then((r) => r.data);

export function HouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<HousePhoto | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HouseFormData>({ resolver: zodResolver(houseSchema) });

  const {
    data: house,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["houses", id],
    queryFn: () => fetchHouse(id!),
    enabled: !!id,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: fetchStaff,
    enabled: editOpen,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadPhoto,
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["houses", id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setUploadError(
        msg ?? "Erro ao enviar foto. Verifique o arquivo e tente novamente.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses", id] });
      setDeleteTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses", id] });
      queryClient.invalidateQueries({ queryKey: ["houses"] });
      setEditOpen(false);
    },
  });

  const openEdit = () => {
    if (!house) return;
    reset({
      name: house.name,
      generalCapacity: house.generalCapacity ?? undefined,
      staffCapacity: house.staffCapacity ?? undefined,
      address: house.address ?? "",
      city: house.city ?? "",
      state: house.state ?? "",
      coordinatorId: house.coordinatorId ?? "",
      phone: house.phone ?? "",
    });
    setEditOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && id) {
      uploadMutation.mutate({ id, file });
    }
    e.target.value = "";
  };

  const onSubmit = (data: HouseFormData) => {
    if (id) updateMutation.mutate({ id, ...data });
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (isError || !house)
    return <p className="text-destructive">Casa não encontrada.</p>;

  const hasCapacity =
    house.generalCapacity != null || house.staffCapacity != null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/houses")}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold flex-1">{house.name}</h1>
      </div>

      <div className="rounded-lg border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Informações
          </h2>
          <Button variant="ghost" size="sm" onClick={openEdit}>
            <Pencil size={14} className="mr-2" />
            Editar
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <span className="text-muted-foreground">Endereço</span>
          <span>{house.address || "—"}</span>

          <span className="text-muted-foreground">Cidade / UF</span>
          <span>
            {[house.city, house.state].filter(Boolean).join(" — ") || "—"}
          </span>

          <span className="text-muted-foreground">Telefone</span>
          <span>{house.phone || "—"}</span>

          <span className="text-muted-foreground">Coordenador</span>
          <span>{house.coordinator?.name || "—"}</span>

          {hasCapacity && (
            <>
              <span className="text-muted-foreground">Ocupação</span>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="font-semibold">
                    {Math.max(
                      0,
                      (house.generalCapacity ?? 0) +
                        (house.staffCapacity ?? 0) -
                        house.staffCount -
                        house.activeResidentsCount,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">vagas</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{house.activeResidentsCount}</p>
                  <p className="text-xs text-muted-foreground">filhos</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{house.staffCount}</p>
                  <p className="text-xs text-muted-foreground">servos</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Galeria de Fotos
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <ImagePlus size={14} className="mr-2" />
            )}
            Adicionar foto
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        {uploadError && (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}

        {house.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma foto cadastrada.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {house.photos.map((photo) => (
              <div
                key={photo.id}
                className="relative rounded-md overflow-hidden aspect-video bg-muted"
              >
                <img
                  src={`${API_ORIGIN}${photo.url}`}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setDeleteTarget(photo)}
                  className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white transition-opacity"
                  title="Remover foto"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover foto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta foto?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget &&
                id &&
                deleteMutation.mutate({ houseId: id, photoId: deleteTarget.id })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => !open && setEditOpen(false)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Casa</DialogTitle>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-1 sm:col-span-2 space-y-2">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || updateMutation.isPending}
              >
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
