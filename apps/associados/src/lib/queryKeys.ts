export const queryKeys = {
  associate: {
    byToken: (token: string) => ['associate', 'public', token] as const,
  },
} as const;
