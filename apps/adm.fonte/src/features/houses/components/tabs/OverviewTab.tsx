import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useHouseById, useUploadHousePhoto, useDeleteHousePhoto } from '../../hooks/useHouses';
import { HouseDialog } from '../HouseDialog';
import type { House } from '@fonte/api-client';

type HousePhoto = House['photos'][number];

export function OverviewTab({ houseId }: { houseId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<HousePhoto | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: house } = useHouseById(houseId);
  const uploadMutation = useUploadHousePhoto(houseId);
  const deleteMutation = useDeleteHousePhoto(houseId);

  if (!house) return null;

  const hasCapacity = house.generalCapacity != null || house.staffCapacity != null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informações</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={14} className="mr-2" />
            Editar
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <span className="text-muted-foreground">Endereço</span>
          <span>{house.address || '—'}</span>
          <span className="text-muted-foreground">Cidade / UF</span>
          <span>{[house.city, house.state].filter(Boolean).join(' — ') || '—'}</span>
          <span className="text-muted-foreground">Telefone</span>
          <span>{house.phone || '—'}</span>
          <span className="text-muted-foreground">Coordenador</span>
          <span>{house.coordinator?.name || '—'}</span>
          {hasCapacity && (
            <>
              <span className="text-muted-foreground">Ocupação</span>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="font-semibold">
                    {Math.max(0, (house.generalCapacity ?? 0) + (house.staffCapacity ?? 0) - house.staffCount - house.activeResidentsCount)}
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
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Galeria de Fotos</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending
              ? <Loader2 size={14} className="mr-2 animate-spin" />
              : <ImagePlus size={14} className="mr-2" />}
            Adicionar foto
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadMutation.mutate(file, {
                  onSuccess: () => setUploadError(null),
                  onError: (err) => setUploadError(getErrorMessage(err, 'Erro ao enviar foto.')),
                });
              }
              e.target.value = '';
            }}
          />
        </div>
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        {house.photos.length === 0 ? (
          <EmptyState title="Nenhuma foto cadastrada." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {house.photos.map((photo) => (
              <div key={photo.id} className="relative rounded-md overflow-hidden aspect-video bg-muted">
                <img src={api.photoUrl(photo.url)!} alt={photo.filename} className="w-full h-full object-cover" />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover foto</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover esta foto?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HouseDialog open={editOpen} house={house} onClose={() => setEditOpen(false)} />
    </div>
  );
}
