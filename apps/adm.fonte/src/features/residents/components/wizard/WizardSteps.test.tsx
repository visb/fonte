import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { WizardSteps } from './WizardSteps';

afterEach(() => cleanup());

describe('WizardSteps', () => {
  const steps = ['Dados', 'Familiares', 'Revisão'];

  it('renderiza todos os rótulos das etapas', () => {
    render(<WizardSteps steps={steps} current={1} />);
    expect(screen.getByText('Dados')).toBeInTheDocument();
    expect(screen.getByText('Familiares')).toBeInTheDocument();
    expect(screen.getByText('Revisão')).toBeInTheDocument();
  });

  it('etapas concluídas mostram check; pendentes mostram o número', () => {
    render(<WizardSteps steps={steps} current={2} />);
    // etapa atual (índice 2) mostra o número 3; etapas 0 e 1 estão concluídas (check)
    expect(screen.getByText('3')).toBeInTheDocument();
    // a primeira etapa concluída não mostra "1" (foi substituído pelo check)
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('na primeira etapa mostra os números 1, 2 e 3', () => {
    render(<WizardSteps steps={steps} current={0} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
