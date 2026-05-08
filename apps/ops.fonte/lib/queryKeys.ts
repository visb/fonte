export const queryKeys = {
  residents: {
    byHouse: (houseId: string) => ['residents', houseId] as const,
    countByHouse: (houseId: string) => ['residents-count', houseId] as const,
    detail: (id: string) => ['resident', id] as const,
  },
  incidents: {
    all: ['incidents'] as const,
    byHouse: (houseId: string) => ['incidents', houseId] as const,
    todayByHouse: (houseId: string) => ['incidents-today', houseId] as const,
  },
  storeroom: {
    allItems: ['storeroom-items'] as const,
    items: (houseId: string) => ['storeroom-items', houseId] as const,
    allMovements: ['storeroom-movements'] as const,
    movements: (itemId: string) => ['storeroom-movements', itemId] as const,
  },
} as const;
