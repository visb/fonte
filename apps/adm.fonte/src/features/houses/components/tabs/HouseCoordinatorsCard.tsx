import { Phone } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PersonAvatar } from '@/components/shared/PersonAvatar';
import { maskPhone } from '@/lib/masks';
import type { House } from '@fonte/api-client';

/**
 * Coordenadores da casa (story 194): lista derivada de `Staff` que o detalhe já
 * devolve — quem é coordenador se resolve no cadastro de servos, não aqui. O
 * titular (`coordinatorId`) é só a referência/contato da casa, sem permissão
 * extra: por isso ele aparece na mesma lista, marcado por badge.
 */
export function HouseCoordinatorsCard({ house }: { house: House }) {
  const coordinators = house.coordinators ?? [];

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Coordenadores
      </h2>
      {coordinators.length === 0 ? (
        <EmptyState
          title="Nenhum coordenador lotado nesta casa."
          description="Lote um coordenador pelo cadastro de servos."
        />
      ) : (
        <div className="space-y-1">
          {coordinators.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <PersonAvatar size="sm" url={c.photoUrl} name={c.name} />
                <p className="font-medium text-sm truncate">{c.name}</p>
                {house.coordinatorId === c.id && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Titular
                  </span>
                )}
              </div>
              {c.whatsapp && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Phone size={12} />
                  {maskPhone(c.whatsapp)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
