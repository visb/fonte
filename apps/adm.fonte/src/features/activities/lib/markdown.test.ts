import { describe, expect, it } from 'vitest';
import { markdownToSafeHtml } from './markdown';

describe('markdownToSafeHtml (story 72 — render seguro da descrição)', () => {
  it('converte negrito e itálico', () => {
    const html = markdownToSafeHtml('Texto **forte** e _fraco_.');
    expect(html).toContain('<strong>forte</strong>');
    expect(html).toContain('<em>fraco</em>');
  });

  it('converte listas com marcadores', () => {
    const html = markdownToSafeHtml('- um\n- dois');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>um</li>');
    expect(html).toContain('<li>dois</li>');
  });

  it('converte links http e força target/rel seguros', () => {
    const html = markdownToSafeHtml('[site](https://exemplo.com)');
    expect(html).toContain('href="https://exemplo.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('remove <script> embutido no markdown', () => {
    const html = markdownToSafeHtml('Oi <script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
  });

  it('barra link com protocolo javascript:', () => {
    const html = markdownToSafeHtml('[x](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('barra link com protocolo data:', () => {
    const html = markdownToSafeHtml('[x](data:text/html,<script>alert(1)</script>)');
    expect(html.toLowerCase()).not.toContain('data:text/html');
    expect(html).not.toContain('<script');
  });

  it('remove atributo de evento inline (onerror)', () => {
    const html = markdownToSafeHtml('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<img');
  });

  it('mantém link mailto', () => {
    const html = markdownToSafeHtml('[contato](mailto:ola@x.com)');
    expect(html).toContain('href="mailto:ola@x.com"');
  });
});
