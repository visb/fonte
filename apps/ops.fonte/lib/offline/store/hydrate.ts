/**
 * Hidratação do cache do React Query a partir do store local (story 175).
 *
 * É o que faz a ficha **abrir com dado** sem sinal, mesmo em filho que nunca foi
 * aberto neste aparelho: no boot (e depois de cada sincronização) o conteúdo do
 * store é semeado no `queryClient` com o carimbo de quando foi gravado, então os
 * hooks continuam com a assinatura de sempre — quem os chama nem sabe que existe
 * um banco local embaixo.
 */
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { readStoreDump } from './residentStore';
import type { ResidentDetailKind } from './schema';

/** Bloco de detalhe → query key do hook que o consome. */
export const DETAIL_QUERY_KEY: Record<
  ResidentDetailKind,
  (residentId: string) => readonly unknown[]
> = {
  follow_ups: (id) => queryKeys.residents.followUps(id),
  attachments: (id) => queryKeys.residents.attachments(id),
  consents: (id) => queryKeys.residents.consents(id),
  receivables: (id) => queryKeys.residents.receivables(id),
};

/**
 * `updatedAt` explícito: o dado é do disco, não desta sessão. Sem isso a query
 * nasceria "fresca" e a tela mentiria sobre o frescor do que está mostrando.
 */
function seed(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  data: unknown,
  updatedAt: number,
): void {
  queryClient.setQueryData(queryKey, data, { updatedAt });
}

/**
 * Marca a chave como **pendente de confirmação**: a tela mostra o que veio do
 * disco e busca no servidor ao montar, se houver rede. `refetchType: 'none'`
 * porque nada precisa ser buscado *agora* — sem sinal isso só queimaria
 * tentativa.
 */
function needsServerConfirmation(queryClient: QueryClient, queryKey: readonly unknown[]): void {
  void queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
}

export async function hydrateResidentQueries(queryClient: QueryClient): Promise<void> {
  const dump = await readStoreDump();

  for (const house of dump.houses) {
    const byHouse = queryKeys.residents.byHouse(house.houseId);
    const countByHouse = queryKeys.residents.countByHouse(house.houseId);

    seed(queryClient, byHouse, house.residents, house.updatedAt);
    // A home conta os filhos com a mesma carga da lista (`residents-count`).
    seed(queryClient, countByHouse, house.residents, house.updatedAt);

    // A lista guardada é o **subconjunto presente** da casa — é o que o snapshot
    // da story 177 devolve. Só que a mesma chave serve telas que precisam de
    // mais que isso: a contagem lista também quem entrou por ela
    // (`CENSUS_ADDED`) e a listagem tem filtro por status. Semear como dado
    // fresco faria essas telas **nunca** buscarem, e quem está fora do "presente"
    // sumiria com rede e tudo. Marcada como pendente, a rede continua sendo a
    // verdade quando existe — que é o que o cache em blob já dava, porque voltava
    // do disco velho.
    needsServerConfirmation(queryClient, byHouse);
    needsServerConfirmation(queryClient, countByHouse);
  }

  for (const entry of dump.residents) {
    const detail = queryKeys.residents.detail(entry.data.id);
    seed(queryClient, detail, entry.data, entry.updatedAt);
    // A linha guardada é a **enxuta** da listagem da casa (`id, name, status,
    // entryDate, photoUrl, photoThumbUrl` — sem `houseId`, entre outros) e a
    // ficha precisa de mais que isso. Semear como dado fresco fazia a tela
    // **nunca** buscar dentro do `staleTime`: `houseId` vazio derrubava o
    // catálogo de produtos ("Nenhum produto encontrado.") e escondia a troca de
    // ministério. Marcada como pendente, a ficha abre com o dado do disco e a
    // rede continua sendo a verdade quando existe.
    needsServerConfirmation(queryClient, detail);
  }

  for (const detail of dump.details) {
    seed(
      queryClient,
      DETAIL_QUERY_KEY[detail.kind](detail.residentId),
      detail.data,
      detail.updatedAt,
    );
  }

  for (const ministry of dump.ministries) {
    seed(queryClient, queryKeys.houses.ministries(ministry.houseId), ministry.data, ministry.updatedAt);
  }
}
