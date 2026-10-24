import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  STAFF_FILTERS_PREFERENCE_KEY,
  type StaffFiltersPreference,
  type StaffListStatus,
} from '@fonte/types';
import { useDebounce } from '@/lib/useDebounce';
import { usePreference } from '@/features/preferences/hooks/usePreference';

/** Filtros que participam da preferência/hidratação. `q` (busca) fica de fora. */
const PERSISTED_FILTER_PARAMS = ['status', 'house'] as const;

export const STAFF_SEARCH_DEBOUNCE_MS = 400;

interface Options {
  /** Só o ADMIN escolhe casa; para os demais `house` da URL é ignorado (LGPD). */
  canFilterHouse: boolean;
}

/**
 * Story 223 — filtros da lista de servos na URL (`q`, `status`, `house`) com a
 * preferência `staff.filters` (story 130). Mesmo contrato da tela de filhos:
 * - `status` ausente = `active`; `dismissed` é o único valor escrito na URL;
 * - URL sem nenhum filtro persistido + preferência salva → hidrata a URL;
 * - a preferência só é gravada em mudança feita pelo usuário, nunca na hidratação;
 * - a busca é local (responsiva) e vai à URL após o debounce.
 */
export function useStaffFiltersUrl({ canFilterHouse }: Options) {
  const [searchParams, setSearchParams] = useSearchParams();

  const status: StaffListStatus = searchParams.get('status') === 'dismissed' ? 'dismissed' : 'active';
  const houseId = canFilterHouse ? (searchParams.get('house') ?? '') : '';

  const setParam = (key: string, value: string | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === undefined) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const [savedFilters, setSavedFilters] = usePreference<StaffFiltersPreference | null>(
    STAFF_FILTERS_PREFERENCE_KEY,
    null,
  );

  // Hidratação no mount: só quando a URL não traz NENHUM filtro persistido —
  // link compartilhado é determinístico.
  useEffect(() => {
    const urlHasFilter = PERSISTED_FILTER_PARAMS.some((k) => searchParams.has(k));
    if (urlHasFilter || !savedFilters) return;
    const hydrateHouse = canFilterHouse && !!savedFilters.house;
    if (savedFilters.status !== 'dismissed' && !hydrateHouse) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (savedFilters.status === 'dismissed') next.set('status', 'dismissed');
        if (hydrateHouse) next.set('house', savedFilters.house);
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = (next: StaffListStatus) => {
    setParam('status', next === 'dismissed' ? next : undefined);
    setSavedFilters({ status: next, house: houseId });
  };

  const setHouseId = (next: string) => {
    if (!canFilterHouse) return;
    setParam('house', next || undefined);
    setSavedFilters({ status, house: next });
  };

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, STAFF_SEARCH_DEBOUNCE_MS);

  // Guarda por VALOR, não por ref de "primeira montagem" — ver o comentário do
  // StrictMode em `ResidentsPage.tsx`: uma navegação extra no mount sobrescreveria
  // a hidratação (o `setSearchParams` não encadeia updates no mesmo commit).
  useEffect(() => {
    const currentQuery = searchParams.get('q') ?? '';
    if (debouncedSearch === currentQuery) return;
    setParam('q', debouncedSearch || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return {
    search,
    setSearch,
    debouncedSearch: debouncedSearch.trim(),
    status,
    setStatus,
    houseId,
    setHouseId,
    /** Busca ou casa ativas — o estado vazio vira "Nenhum servo encontrado.". */
    isFiltering: debouncedSearch.trim() !== '' || houseId !== '',
  };
}
