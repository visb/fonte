import { User } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { box: 'w-9 h-9', icon: 16 },
  md: { box: 'w-10 h-10', icon: 18 },
  lg: { box: 'w-12 h-12', icon: 22 },
} as const;

export type PersonAvatarSize = keyof typeof SIZES;

interface PersonAvatarProps {
  /** Caminho cru vindo da API (o helper resolve local vs. bucket). */
  url: string | null | undefined;
  /** Vira o `alt` da imagem. */
  name: string;
  size?: PersonAvatarSize;
  className?: string;
  onClick?: () => void;
}

/**
 * Avatar circular de pessoa (filho, servo) com fallback no ícone de usuário.
 *
 * A resolução da URL fica dentro do componente (`api.photoUrl`), não no
 * chamador: era o mesmo markup copiado em 6 telas e centralizar tira a chance de
 * alguém mandar o caminho cru direto para o `src`.
 */
export function PersonAvatar({ url, name, size = 'md', className, onClick }: PersonAvatarProps) {
  const src = api.photoUrl(url);
  const { box, icon } = SIZES[size];

  return (
    <div
      className={cn(
        box,
        'rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden',
        className,
      )}
      onClick={onClick}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <User size={icon} className="text-muted-foreground" />
      )}
    </div>
  );
}
