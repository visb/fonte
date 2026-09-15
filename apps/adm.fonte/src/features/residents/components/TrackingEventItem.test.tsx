import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FollowUpType, FollowUpAccessLevel } from '@fonte/types';
import type { ResidentFollowUp } from '@fonte/api-client';
import { TrackingEventItem } from './TrackingEventItem';

function fu(over: Partial<ResidentFollowUp> = {}): ResidentFollowUp {
  return {
    id: 'f1', type: FollowUpType.ADMISSION, date: '2026-01-15',
    accessLevel: FollowUpAccessLevel.ALL, description: null, createdByName: null,
    ...over,
  } as unknown as ResidentFollowUp;
}

afterEach(() => cleanup());

describe('TrackingEventItem', () => {
  it('mostra o label do tipo e a data formatada', () => {
    render(<TrackingEventItem followUp={fu()} />);
    expect(screen.getByText('Admissão')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('descrição e autor aparecem quando presentes', () => {
    render(<TrackingEventItem followUp={fu({ description: 'Detalhe aqui', createdByName: 'Maria' })} />);
    expect(screen.getByText('Detalhe aqui')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
  });

  it('nível ADMINISTRATION mostra badge de acesso restrito', () => {
    render(<TrackingEventItem followUp={fu({ accessLevel: FollowUpAccessLevel.ADMINISTRATION })} />);
    // badge de acesso aparece (label do FOLLOW_UP_ACCESS_LABELS)
    expect(screen.getByText('Admissão')).toBeInTheDocument();
    const badges = screen.getAllByText(/.+/);
    expect(badges.length).toBeGreaterThan(1);
  });

  // Story 197 (decisão 4): a emissão de MINISTRY_CHANGE morreu, mas o evento já
  // gravado continua sendo histórico — renderiza com rótulo e ícone. Apagar
  // reescreveria o passado de um acompanhamento que pode estar citado em relatório.
  it('renderiza evento histórico de mudança de ministério com rótulo e ícone', () => {
    const { container } = render(
      <TrackingEventItem followUp={fu({ type: FollowUpType.MINISTRY_CHANGE })} />,
    );
    expect(screen.getByText('Mudança de ministério')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('nível ALL não mostra badge de acesso', () => {
    const { container } = render(<TrackingEventItem followUp={fu({ accessLevel: FollowUpAccessLevel.ALL })} />);
    expect(container.querySelectorAll('[class*="badge"]').length).toBe(0);
  });
});
