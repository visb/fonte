import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// A resolução da URL é do componente (não do chamador): o mock prefixa para
// provar que o `src` renderizado passou por `api.photoUrl`.
vi.mock('@/lib/api', () => ({
  api: { photoUrl: (u: string | null | undefined) => (u ? `http://api${u}` : null) },
}));

import { PersonAvatar } from './PersonAvatar';

afterEach(() => cleanup());

describe('PersonAvatar (story 181)', () => {
  it('com url, renderiza a imagem com alt do nome e src resolvido por api.photoUrl', () => {
    render(<PersonAvatar url="/uploads/ana.jpg" name="Ana" />);

    const img = screen.getByAltText('Ana') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('http://api/uploads/ana.jpg');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('sem url (%s), cai no fallback e não renderiza <img>', (_label, url) => {
    const { container } = render(<PersonAvatar url={url} name="Ana" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it.each([
    ['sm', 'w-9 h-9'],
    ['md', 'w-10 h-10'],
    ['lg', 'w-12 h-12'],
  ] as const)('size %s aplica a caixa %s', (size, box) => {
    const { container } = render(<PersonAvatar url={null} name="Ana" size={size} />);

    const [w, h] = box.split(' ');
    expect(container.firstElementChild).toHaveClass(w, h);
  });

  it('sem size, o padrão é md', () => {
    const { container } = render(<PersonAvatar url={null} name="Ana" />);

    expect(container.firstElementChild).toHaveClass('w-10', 'h-10');
  });

  it('className extra soma às classes base em vez de substituí-las', () => {
    const { container } = render(
      <PersonAvatar url={null} name="Ana" className="cursor-pointer" />,
    );

    expect(container.firstElementChild).toHaveClass('cursor-pointer', 'rounded-full', 'w-10');
  });

  it('dispara onClick ao clicar', () => {
    const onClick = vi.fn();
    const { container } = render(<PersonAvatar url={null} name="Ana" onClick={onClick} />);

    fireEvent.click(container.firstElementChild!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sem onClick, clicar não estoura', () => {
    const { container } = render(<PersonAvatar url={null} name="Ana" />);

    expect(() => fireEvent.click(container.firstElementChild!)).not.toThrow();
  });
});
