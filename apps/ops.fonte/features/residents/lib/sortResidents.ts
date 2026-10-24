// Story 222: a lista de filhos do ops abre com quem entrou por último no topo.
// A ordenação é no cliente para valer igual online e offline (o snapshot e o
// GET /houses/:id/residents ordenam por nome).

type SortableResident = {
  id: string;
  name: string;
  entryDate?: string | null;
};

/**
 * Ordena por `entryDate` desc (string `YYYY-MM-DD`, sem `new Date()` — fuso
 * não interfere). Sem entrada vai para o fim (NULLS LAST, como o adm). Datas
 * iguais desempatam por nome (`pt-BR`) e depois por `id`. Não muta a entrada.
 */
export function sortResidentsByEntryDesc<T extends SortableResident>(
  list: readonly T[],
): T[] {
  return [...list].sort((a, b) => {
    const da = a.entryDate || null;
    const db = b.entryDate || null;
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da < db ? 1 : -1;
    }
    const byName = a.name.localeCompare(b.name, "pt-BR");
    if (byName !== 0) return byName;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
