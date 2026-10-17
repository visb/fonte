import { Gender } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { api } from '@/lib/api';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { displayCpf, displayRg } from '@/lib/masks';

const genderLabel: Record<string, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
};

interface ReadmissionIdentityCardProps {
  resident: Resident;
  canEditIdentity: boolean;
  onEditIdentity: () => void;
  onPhotoChange: (blob: Blob | null) => void;
}

/** Banner de identidade imutável da reintrodução (nome, documentos, foto). */
export function ReadmissionIdentityCard({
  resident,
  canEditIdentity,
  onEditIdentity,
  onPhotoChange,
}: ReadmissionIdentityCardProps) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4 mb-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Dados de identificação
        </p>
        {canEditIdentity && (
          <Button type="button" variant="ghost" size="sm" onClick={onEditIdentity}>
            Editar
          </Button>
        )}
      </div>
      <div className="flex items-start gap-4">
        <AvatarUpload
          currentUrl={resident.photoUrl ? api.photoUrl(resident.photoUrl) : null}
          onBlobChange={onPhotoChange}
        />
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm flex-1">
          <span className="text-muted-foreground">Nome</span>
          <span className="font-medium">{resident.name}</span>
          {resident.cpf && (
            <>
              <span className="text-muted-foreground">CPF</span>
              <span>{displayCpf(resident.cpf)}</span>
            </>
          )}
          {resident.rg && (
            <>
              <span className="text-muted-foreground">RG</span>
              <span>{displayRg(resident.rg)}</span>
            </>
          )}
          {resident.birthDate && (
            <>
              <span className="text-muted-foreground">Nascimento</span>
              <span>{new Date(resident.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
            </>
          )}
          {resident.gender && (
            <>
              <span className="text-muted-foreground">Gênero</span>
              <span>{genderLabel[resident.gender] ?? resident.gender}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
