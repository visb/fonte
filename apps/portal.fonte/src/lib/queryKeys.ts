export const queryKeys = {
  associate: {
    byToken: (token: string) => ['associate', 'public', token] as const,
    cancelView: (token: string) =>
      ['associate', 'public', 'cancel', token] as const,
  },
  events: {
    list: ['events', 'public'] as const,
    detail: (id: string) => ['events', 'public', id] as const,
  },
  eventPayment: {
    byToken: (token: string) => ['event-payment', 'public', token] as const,
  },
} as const;
