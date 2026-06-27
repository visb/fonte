import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { StaffServiceSelector } from './StaffServiceSelector';

const reg = (name: string): UseFormRegisterReturn =>
  ({ name, onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }) as unknown as UseFormRegisterReturn;

const baseProps = {
  onSelectHouse: vi.fn(),
  onSelectGroup: vi.fn(),
  houses: [
    { id: 'h1', name: 'Casa Um' },
    { id: 'h2', name: 'Casa Dois' },
  ],
  supportGroups: [{ id: 'g1', name: 'Grupo Alfa' }],
  houseIdReg: reg('houseId'),
  supportGroupIdReg: reg('supportGroupId'),
};

afterEach(() => cleanup());

describe('StaffServiceSelector', () => {
  it('modo casa: mostra select de casas com as opções e dispara onSelectGroup', () => {
    const onSelectGroup = vi.fn();
    render(<StaffServiceSelector {...baseProps} servesInGroup={false} onSelectGroup={onSelectGroup} />);
    expect(screen.getByLabelText('Casa *')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Casa Um' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Casa Dois' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Grupo de Apoio *')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Serve no Grupo de Apoio' }));
    expect(onSelectGroup).toHaveBeenCalled();
  });

  it('modo grupo: mostra select de grupos e dispara onSelectHouse', () => {
    const onSelectHouse = vi.fn();
    render(<StaffServiceSelector {...baseProps} servesInGroup onSelectHouse={onSelectHouse} />);
    expect(screen.getByLabelText('Grupo de Apoio *')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Grupo Alfa' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Casa *')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Serve na Casa' }));
    expect(onSelectHouse).toHaveBeenCalled();
  });

  it('mostra mensagens de erro de cada modo', () => {
    const { rerender } = render(
      <StaffServiceSelector {...baseProps} servesInGroup={false} houseIdError="Casa obrigatória" />,
    );
    expect(screen.getByText('Casa obrigatória')).toBeInTheDocument();
    rerender(
      <StaffServiceSelector {...baseProps} servesInGroup supportGroupIdError="Grupo obrigatório" />,
    );
    expect(screen.getByText('Grupo obrigatório')).toBeInTheDocument();
  });
});
