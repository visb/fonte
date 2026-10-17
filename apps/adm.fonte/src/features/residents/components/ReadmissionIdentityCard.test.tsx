import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Resident } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string) => `signed:${u}` } }));
vi.mock('@/components/AvatarUpload', () => ({
  AvatarUpload: ({ currentUrl }: { currentUrl: string | null }) => (
    <div data-testid="avatar">{currentUrl ?? 'sem-foto'}</div>
  ),
}));

import { ReadmissionIdentityCard } from './ReadmissionIdentityCard';

afterEach(() => cleanup());

describe('ReadmissionIdentityCard', () => {
  it('foto existente usa a URL assinada; gênero desconhecido aparece como veio', () => {
    render(
      <ReadmissionIdentityCard
        resident={{ name: 'Fulano', photoUrl: 'p.png', gender: 'OTHER' } as unknown as Resident}
        canEditIdentity
        onEditIdentity={vi.fn()}
        onPhotoChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('avatar')).toHaveTextContent('signed:p.png');
    expect(screen.getByText('OTHER')).toBeInTheDocument();
  });

  it('sem foto nem documentos mostra só o nome; Editar chama o callback', () => {
    const onEditIdentity = vi.fn();
    render(
      <ReadmissionIdentityCard
        resident={{ name: 'Beltrano' } as unknown as Resident}
        canEditIdentity
        onEditIdentity={onEditIdentity}
        onPhotoChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('avatar')).toHaveTextContent('sem-foto');
    expect(screen.queryByText('CPF')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onEditIdentity).toHaveBeenCalled();
  });
});
