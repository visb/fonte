import { sanitizeMarkdown } from './sanitize-markdown';

describe('sanitizeMarkdown (story 72 — descrição WYSIWYG markdown)', () => {
  describe('valores vazios', () => {
    it('null passa direto', () => {
      expect(sanitizeMarkdown(null)).toBeNull();
    });
    it('undefined vira null', () => {
      expect(sanitizeMarkdown(undefined)).toBeNull();
    });
    it('string vazia continua vazia', () => {
      expect(sanitizeMarkdown('')).toBe('');
    });
  });

  describe('markdown legítimo preservado', () => {
    it('negrito e itálico', () => {
      const md = 'Texto com **negrito** e _itálico_.';
      expect(sanitizeMarkdown(md)).toBe(md);
    });

    it('listas com marcadores e numeradas', () => {
      const md = '- item 1\n- item 2\n\n1. primeiro\n2. segundo';
      expect(sanitizeMarkdown(md)).toBe(md);
    });

    it('link http/https legítimo', () => {
      const md = 'Veja [o site](https://exemplo.com) e [outro](http://x.com).';
      expect(sanitizeMarkdown(md)).toBe(md);
    });

    it('link mailto legítimo', () => {
      const md = 'Email: [contato](mailto:ola@exemplo.com).';
      expect(sanitizeMarkdown(md)).toBe(md);
    });

    it('autolink seguro intacto', () => {
      const md = 'Acesse <https://exemplo.com> agora.';
      expect(sanitizeMarkdown(md)).toBe(md);
    });

    it('link relativo/âncora preservado', () => {
      const md = 'Veja [seção](#detalhes) e [rota](/painel).';
      expect(sanitizeMarkdown(md)).toBe(md);
    });
  });

  describe('HTML bruto removido', () => {
    it('remove <script> embutido', () => {
      const out = sanitizeMarkdown('Oi <script>alert(1)</script> tchau');
      expect(out).not.toContain('<script');
      expect(out).not.toContain('</script>');
      expect(out).toContain('alert(1)');
      expect(out).toContain('Oi');
      expect(out).toContain('tchau');
    });

    it('remove <img onerror=...>', () => {
      const out = sanitizeMarkdown('![x](https://ok.com)\n<img src=x onerror=alert(1)>');
      expect(out).not.toContain('<img');
      expect(out).not.toContain('onerror');
      // a imagem markdown legítima permanece
      expect(out).toContain('![x](https://ok.com)');
    });

    it('remove <iframe>', () => {
      const out = sanitizeMarkdown('<iframe src="https://evil.com"></iframe>');
      expect(out).not.toContain('<iframe');
      expect(out).not.toContain('</iframe>');
    });

    it('remove comentários HTML', () => {
      const out = sanitizeMarkdown('antes <!-- malicioso --> depois');
      expect(out).not.toContain('<!--');
      expect(out).toContain('antes');
      expect(out).toContain('depois');
    });

    it('remove tag de evento inline (onclick)', () => {
      const out = sanitizeMarkdown('<a href="x" onclick="evil()">link</a>');
      expect(out).not.toContain('<a');
      expect(out).not.toContain('onclick');
      expect(out).toContain('link');
    });
  });

  describe('protocolo de link perigoso neutralizado', () => {
    it('javascript: em link markdown vira #', () => {
      const out = sanitizeMarkdown('[clique](javascript:alert(1))');
      expect(out).not.toContain('javascript:');
      expect(out).toBe('[clique](#)');
    });

    it('data: em link markdown vira #', () => {
      const out = sanitizeMarkdown('[x](data:text/html,<script>alert(1)</script>)');
      expect(out).not.toContain('data:');
    });

    it('vbscript: em link markdown vira #', () => {
      const out = sanitizeMarkdown('[x](vbscript:msgbox(1))');
      expect(out).not.toContain('vbscript:');
      expect(out).toBe('[x](#)');
    });

    it('javascript: case-insensitive e com espaços', () => {
      const out = sanitizeMarkdown('[x]( JavaScript:alert(1) )');
      expect(out?.toLowerCase()).not.toContain('javascript:');
    });

    it('autolink javascript: rebaixado para texto puro', () => {
      const out = sanitizeMarkdown('<javascript:alert(1)>');
      // sem os delimitadores <> que tornariam o autolink clicável
      expect(out).not.toContain('<');
      expect(out).not.toContain('>');
    });
  });

  describe('combinação de vetores', () => {
    it('preserva markdown válido e remove só o perigoso', () => {
      const md = [
        'Tarefa **importante**:',
        '- [link bom](https://ok.com)',
        '- [link ruim](javascript:alert(1))',
        '<script>steal()</script>',
      ].join('\n');
      const out = sanitizeMarkdown(md);
      expect(out).toContain('**importante**');
      expect(out).toContain('[link bom](https://ok.com)');
      expect(out).toContain('[link ruim](#)');
      expect(out).not.toContain('javascript:');
      expect(out).not.toContain('<script');
      expect(out).not.toContain('</script>');
    });
  });
});
