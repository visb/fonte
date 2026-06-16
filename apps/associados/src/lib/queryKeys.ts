export const queryKeys = {
  associate: {
    byToken: (token: string) => ['associate', 'public', token] as const,
    cancelView: (token: string) =>
      ['associate', 'public', 'cancel', token] as const,
  },
} as const;
