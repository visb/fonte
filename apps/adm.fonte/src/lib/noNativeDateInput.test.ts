import { describe, expect, it } from 'vitest';

// Catraca da story 201: todo campo de data do adm usa o `DateInput`
// (`@/components/shared/DateInput` / `ControlledDateInput`). O `<input type="date">`
// nativo não volta — visual e comportamento variam por navegador e não seguem o
// shadcn. `datetime-local` (eventos) fica fora desta regra.
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const NATIVE_DATE = /type\s*=\s*\{?\s*["'`]date["'`]/;

describe('catraca: sem input de data nativo no adm (story 201)', () => {
  it('varre arquivos de código do src', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('nenhum arquivo fora de teste usa type="date"', () => {
    const offenders = Object.entries(sources)
      .filter(([, code]) => NATIVE_DATE.test(code))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
