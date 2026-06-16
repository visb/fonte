import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

// Upload de source maps só quando há authToken (CI/build de produção).
// Em dev o plugin fica fora e não exige credenciais.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  plugins: [
    react(),
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT ?? 'fonte-associados',
            authToken: sentryAuthToken,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@fonte/types', '@fonte/api-client'],
  },
  // Source maps para o Sentry desanonimizar stack traces de produção.
  build: {
    sourcemap: true,
  },
  server: {
    port: 5175,
  },
});
