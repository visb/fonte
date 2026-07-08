import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ImportAdmission } from '@fonte/api-client';
import { ImportAdmissionsHistory } from './ImportAdmissionsHistory';

afterEach(() => cleanup());

describe('ImportAdmissionsHistory', () => {
  it('lista os pares entrada→saída com o status previsto pela permanência', () => {
    const admissions: ImportAdmission[] = [
      { entryDate: '2022-01-10', exitDate: '2022-09-10' }, // 8 meses → Alta
      { entryDate: '2023-03-01', exitDate: '2023-05-01' }, // 2 meses → Evasão
    ];
    render(<ImportAdmissionsHistory admissions={admissions} />);

    const list = screen.getByRole('list', { name: 'Acolhimentos detectados' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(items[0]).toHaveTextContent('10/01/2022');
    expect(items[0]).toHaveTextContent('10/09/2022');
    expect(items[0]).toHaveTextContent('Alta');

    expect(items[1]).toHaveTextContent('01/03/2023');
    expect(items[1]).toHaveTextContent('01/05/2023');
    expect(items[1]).toHaveTextContent('Evasão');
  });

  it('acolhimento em aberto (sem saída) mostra "—" e status Ativo', () => {
    const admissions: ImportAdmission[] = [
      { entryDate: '2021-01-01', exitDate: '2021-07-01' },
      { entryDate: '2023-01-01', exitDate: null },
    ];
    render(<ImportAdmissionsHistory admissions={admissions} />);

    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveTextContent('01/01/2023');
    expect(items[1]).toHaveTextContent('—');
    expect(items[1]).toHaveTextContent('Ativo');
  });

  it('não renderiza nada quando há um único acolhimento (é o topo do resident)', () => {
    const { container } = render(
      <ImportAdmissionsHistory admissions={[{ entryDate: '2023-01-01', exitDate: '2023-08-01' }]} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Acolhimentos detectados')).not.toBeInTheDocument();
  });

  it('não renderiza nada quando não há acolhimentos', () => {
    const { container } = render(<ImportAdmissionsHistory admissions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
