import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
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

interface Staff {
  id: string;
  name: string;
  phone: string | null;
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
  capacity: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  coordinatorId: string | null;
  coordinator: Staff | null;
  phone: string | null;
  photos: HousePhoto[];
  activeResidentsCount: number;
  staffCount: number;
}

const fetchHouse = (id: string) =>
  api.get<House>(`/houses/${id}`).then((r) => r.data);

const uploadPhoto = ({ id, file }: { id: string; file: File }) => {
  const form = new FormData();
  form.append("file", file);
  // Content-Type: undefined remove o padrão 'application/json' da instância axios,
  // deixando o browser gerar 'multipart/form-data; boundary=...' corretamente
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

export function HouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<HousePhoto | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    data: house,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["houses", id],
    queryFn: () => fetchHouse(id!),
    enabled: !!id,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && id) {
      uploadMutation.mutate({ id, file });
    }
    e.target.value = "";
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (isError || !house)
    return <p className="text-destructive">Casa não encontrada.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/houses")}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold flex-1">{house.name}</h1>
      </div>

      <div className="rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Informações
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {house.address && (
            <>
              <span className="text-muted-foreground">Endereço</span>
              <span>{house.address}</span>
            </>
          )}
          {(house.city || house.state) && (
            <>
              <span className="text-muted-foreground">Cidade / UF</span>
              <span>
                {[house.city, house.state].filter(Boolean).join(" — ")}
              </span>
            </>
          )}
          {house.phone && (
            <>
              <span className="text-muted-foreground">Telefone</span>
              <span>{house.phone}</span>
            </>
          )}
          {house.coordinator && (
            <>
              <span className="text-muted-foreground">Coordenador</span>
              <span>{house.coordinator.name}</span>
            </>
          )}
          {house.capacity != null && (
            <>
              <span className="text-muted-foreground">Ocupação</span>
              <span>
                {house.activeResidentsCount + house.staffCount} /{" "}
                {house.capacity} ocupação
              </span>
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
          <div className="grid grid-cols-3 gap-3">
            {house.photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-md overflow-hidden aspect-video bg-muted"
              >
                <img
                  src={`${API_ORIGIN}${photo.url}`}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setDeleteTarget(photo)}
                  className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
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
              Tem certeza que deseja remover esta foto? Esta ação não pode ser
              desfeita.
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
    </div>
  );
}
