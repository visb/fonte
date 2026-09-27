/**
 * Catálogo de apresentação da fila de sincronização (story 170, decisão 4).
 *
 * Cada chave da outbox (`OUTBOX_MUTATION_KEYS`, story 169) ganha aqui o que a
 * tela precisa mostrar além do rótulo: ícone e um **detalhe curto** que deixe o
 * operador reconhecer o próprio lançamento ("Entrada de 2", "João da Silva").
 *
 * O rótulo humano continua morando em `lib/offline/outbox.ts` — ele é gravado
 * junto da dead-letter no momento da falha, então precisa existir fora da árvore
 * React. Duplicá-lo aqui criaria duas verdades; o que este arquivo garante é que
 * **toda** chave tenha rótulo e apresentação, e o `constants.test.ts` quebra
 * quando alguém adiciona chave nova sem passar por aqui.
 *
 * Atenção aos nomes: `storeroom` é a **Dispensa** e `supplyRoom` é o
 * **Almoxarifado** na UI — os rótulos seguem o que o operador lê na tela.
 */
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { MovementType, ResidentStatus } from '@fonte/types';
import { OUTBOX_MUTATION_KEYS, outboxLabel, serializeMutationKey } from '@/lib/offline/outbox';
import type {
  ActivityCommentVariables,
  ActivityCreateVariables,
  CensusAddResidentVariables,
  CensusConcludeVariables,
  IncidentCreateVariables,
  ResidentUpdateStatusVariables,
  StoreroomItemVariables,
  StoreroomMovementVariables,
  StreetSaleCreateVariables,
  SupplyItemVariables,
  SupplyMovementVariables,
} from '@/lib/offline/mutationDefaults';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Selo de status no card. Curto de propósito e diferente do título da seção —
 * "Pendente" é o mesmo termo dos cards de dispensa/almoxarifado (story 169).
 */
export const SYNC_STATUS_LABELS = {
  pending: 'Pendente',
  failed: 'Recusada',
} as const;

export const SYNC_SECTION_TITLES = {
  pending: 'Aguardando envio',
  failed: 'Não enviadas',
} as const;

export const SYNC_SECTION_DESCRIPTIONS = {
  pending: 'Vão subir sozinhas assim que a conexão voltar.',
  failed: 'O servidor recusou. Reenvie ou descarte.',
} as const;

/** Detalhe curto de um item; `null` quando o rótulo já diz tudo. */
type DetailBuilder = (variables: never) => string | null;

export interface SyncItemPresentation {
  icon: IoniconName;
  tint: string;
  background: string;
  detail: DetailBuilder;
}

const MAX_DETAIL_LENGTH = 60;

function truncate(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_DETAIL_LENGTH
    ? `${trimmed.slice(0, MAX_DETAIL_LENGTH - 1)}…`
    : trimmed;
}

/** Quantidade sem casas decimais inúteis (`2` e não `2.00`). */
function formatQuantity(quantity: number): string {
  return String(Number(quantity)).replace('.', ',');
}

function movementDetail(variables: StoreroomMovementVariables | SupplyMovementVariables): string {
  const direction = variables.data.type === MovementType.IN ? 'Entrada' : 'Saída';
  return `${direction} de ${formatQuantity(variables.data.quantity)}`;
}

const RESIDENT_STATUS_LABELS: Record<ResidentStatus, string> = {
  [ResidentStatus.PRE_ADMISSION]: 'Pré-admissão',
  [ResidentStatus.ACTIVE]: 'Ativo',
  [ResidentStatus.DISCIPLINE]: 'Disciplina',
  [ResidentStatus.TEMP_LEAVE]: 'Saída temporária',
  [ResidentStatus.DISCHARGED]: 'Alta',
  [ResidentStatus.EVADED]: 'Evasão',
  [ResidentStatus.CENSUS_ADDED]: 'Adicionado na contagem',
  [ResidentStatus.REJECTED_CENSUS]: 'Recusado na contagem',
  [ResidentStatus.ARCHIVED]: 'Arquivado',
};

/** Amarra o builder ao tipo de variáveis da chave sem espalhar cast na tabela. */
function detailOf<T>(build: (variables: T) => string | null): DetailBuilder {
  return build as DetailBuilder;
}

const noDetail: DetailBuilder = () => null;

/**
 * Apresentação por chave **serializada** (`storeroom/createMovement`) — é essa a
 * forma que a dead-letter guarda e a que a fila pendente expõe.
 */
export const SYNC_ITEM_PRESENTATION: Record<string, SyncItemPresentation> = {
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.productContributionDeclare)]: {
    icon: 'gift-outline', tint: '#16a34a', background: '#f0fdf4', detail: noDetail,
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.censusAddResident)]: {
    icon: 'person-add-outline',
    tint: '#0d9488',
    background: '#f0fdfa',
    detail: detailOf<CensusAddResidentVariables>((variables) => truncate(variables.data?.name)),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.censusConclude)]: {
    icon: 'checkbox-outline',
    tint: '#0d9488',
    background: '#f0fdfa',
    detail: detailOf<CensusConcludeVariables>((variables) =>
      variables.data ? `${variables.data.confirmedCount} de ${variables.data.total} filhos` : null,
    ),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.residentUploadPhoto)]: {
    icon: 'camera-outline',
    tint: '#9333ea',
    background: '#faf5ff',
    detail: noDetail,
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.residentUpdateStatus)]: {
    icon: 'swap-horizontal-outline',
    tint: '#9333ea',
    background: '#faf5ff',
    detail: detailOf<ResidentUpdateStatusVariables>((variables) => {
      const status = variables.data?.status;
      return status ? (RESIDENT_STATUS_LABELS[status] ?? null) : null;
    }),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.incidentCreate)]: {
    icon: 'warning-outline',
    tint: '#dc2626',
    background: '#fef2f2',
    detail: detailOf<IncidentCreateVariables>((variables) =>
      truncate(variables.data?.description),
    ),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.storeroomCreateMovement)]: {
    icon: 'cube-outline',
    tint: '#16a34a',
    background: '#f0fdf4',
    detail: detailOf<StoreroomMovementVariables>(movementDetail),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.storeroomCreateItem)]: {
    icon: 'cube-outline',
    tint: '#16a34a',
    background: '#f0fdf4',
    detail: detailOf<StoreroomItemVariables>((variables) => truncate(variables.data?.name)),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement)]: {
    icon: 'sparkles-outline',
    tint: '#2563eb',
    background: '#eff6ff',
    detail: detailOf<SupplyMovementVariables>(movementDetail),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.supplyRoomCreateItem)]: {
    icon: 'sparkles-outline',
    tint: '#2563eb',
    background: '#eff6ff',
    detail: detailOf<SupplyItemVariables>((variables) => truncate(variables.data?.name)),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.streetSaleCreate)]: {
    icon: 'storefront-outline',
    tint: '#b45309',
    background: '#fffbeb',
    detail: detailOf<StreetSaleCreateVariables>((variables) =>
      variables.data ? `${formatQuantity(variables.data.quantity)} un.` : null,
    ),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.streetSaleUpdate)]: {
    icon: 'storefront-outline',
    tint: '#b45309',
    background: '#fffbeb',
    detail: noDetail,
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.activityCreate)]: {
    icon: 'checkbox-outline',
    tint: '#4f46e5',
    background: '#eef2ff',
    detail: detailOf<ActivityCreateVariables>((variables) => truncate(variables.data?.title)),
  },
  [serializeMutationKey(OUTBOX_MUTATION_KEYS.activityComment)]: {
    icon: 'chatbubble-outline',
    tint: '#4f46e5',
    background: '#eef2ff',
    detail: detailOf<ActivityCommentVariables>((variables) => truncate(variables.data?.body)),
  },
};

/** Fallback legível: chave desconhecida aparece na tela, nunca some (decisão 4). */
export const FALLBACK_SYNC_PRESENTATION: SyncItemPresentation = {
  icon: 'sync-outline',
  tint: '#4b5563',
  background: '#f3f4f6',
  detail: noDetail,
};

export function syncItemPresentation(mutationKey: string): SyncItemPresentation {
  return SYNC_ITEM_PRESENTATION[mutationKey] ?? FALLBACK_SYNC_PRESENTATION;
}

/**
 * Rótulo humano da chave serializada. A ida e volta pelo `split('/')` é exata:
 * `serializeMutationKey` só junta os segmentos com barra.
 */
export function syncItemLabel(mutationKey: string): string {
  return outboxLabel(mutationKey.split('/'));
}

export function syncItemDetail(mutationKey: string, variables: unknown): string | null {
  try {
    return syncItemPresentation(mutationKey).detail(variables as never);
  } catch {
    // Variáveis vindas do disco podem estar em formato antigo: a tela mostra o
    // item sem detalhe em vez de quebrar a lista inteira.
    return null;
  }
}
