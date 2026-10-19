import { render, screen } from '@testing-library/react';
import { MarkdownBody } from './MarkdownBody';

describe('MarkdownBody', () => {
  it('renderiza subtítulo h3 e listas', () => {
    render(<MarkdownBody source={'### Detalhe\n- um\n- dois'} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Detalhe' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
