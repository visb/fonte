import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { DocumentTemplate } from '@fonte/api-client';
import { TemplateCard } from './TemplateCard';

afterEach(() => cleanup());

function template(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 't1',
    name: 'Termo de Acolhimento',
    isRequired: false,
    updatedAt: '2026-06-01T12:00:00.000Z',
    html: '<p/>',
    ...overrides,
  } as DocumentTemplate;
}

describe('TemplateCard', () => {
  it('mostra nome e data de atualização', () => {
    render(<TemplateCard template={template()} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Termo de Acolhimento')).toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/)).toBeInTheDocument();
  });

  it('mostra badge Acolhimento só quando isRequired', () => {
    const { rerender } = render(<TemplateCard template={template()} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('Acolhimento')).not.toBeInTheDocument();
    rerender(<TemplateCard template={template({ isRequired: true })} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Acolhimento')).toBeInTheDocument();
  });

  it('clique no card seleciona; clique no lixo exclui sem propagar select', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(<TemplateCard template={template()} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Termo de Acolhimento'));
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    // stopPropagation: select não disparou de novo no clique do lixo
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
