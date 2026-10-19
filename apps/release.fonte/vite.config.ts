import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { loadReleases } from './src/lib/releases';

const RELEASES_DIR = path.resolve(__dirname, 'content/releases');

// O conteúdo do changelog é lido no browser via import.meta.glob, ou seja, o
// parse só rodaria em runtime. Este plugin roda o MESMO parser no início do
// build (e do dev server): frontmatter inválido quebra o build em vez de sumir
// em silêncio da página publicada.
function validateReleases(): Plugin {
  return {
    name: 'fonte-validate-releases',
    buildStart() {
      const files = Object.fromEntries(
        fs
          .readdirSync(RELEASES_DIR)
          .filter((file) => file.endsWith('.md'))
          .map((file) => [file, fs.readFileSync(path.join(RELEASES_DIR, file), 'utf8')]),
      );
      loadReleases(files);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), validateReleases()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // O APK e o latest.json NÃO fazem parte do bundle: em produção o stage `web`
  // do Dockerfile copia os dois da imagem `fonte-apk` para /srv/release/downloads.
  // No modo e2e o Vite serve uma fixture (e2e/public/downloads/latest.json) para
  // a suíte exercitar a home com APK publicado — nunca entra no dist.
  publicDir: mode === 'e2e' ? 'e2e/public' : 'public',
  server: {
    port: 5177,
  },
}));
