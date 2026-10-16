import { expect, type Locator } from '@playwright/test';

/** `YYYY-MM-DD` → `dd/mm/aaaa` (o texto que o `DateInput` do adm exibe). */
export function isoToBr(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Preenche um `DateInput` (story 201) digitando `dd/mm/aaaa` e sai do campo com
 * Tab, que fecha o calendário — sem isso o popover aberto cobre o botão de
 * salvar. Recebe a data em `YYYY-MM-DD`, o mesmo formato do input nativo antigo.
 */
export async function fillDate(input: Locator, iso: string) {
  await input.fill(isoToBr(iso));
  await input.press('Tab');
  // O popover também tem role="dialog": espera ele sumir (inclusive a animação
  // de saída) para `getByRole('dialog')` do spec voltar a casar só o modal.
  await expect(input.page().getByRole('grid')).toHaveCount(0);
}
