import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Template do HTML raiz do export web (só roda no build estático, nunca no runtime nativo).
 * Serve para injetar o que o app.json não cobre: ícones e manifest do PWA.
 * O <title> vem do <Head> em app/_layout.tsx — o helmet do expo-router já emite
 * uma tag <title> aqui, e o parser HTML só respeita a primeira.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#272950" />

        <ScrollViewStyleReset />
        {/* Evita flash branco entre o splash do PWA e o primeiro render do React. */}
        <style dangerouslySetInnerHTML={{ __html: `html,body,#root{background-color:#272950;}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
