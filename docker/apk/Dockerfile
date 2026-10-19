# Imagem ghcr.io/visb/fonte-apk:<versão> (story 213) — só um "pacote" de
# arquivos, nunca roda: carrega o APK assinado do ops.fonte e o manifesto que a
# home do release.fonte lê.
#
#   /downloads/ops-<versão>.apk
#   /downloads/latest.json      {version, versionCode, sizeBytes, sha256, builtAt}
#
# Montada pelo release.yml: o contexto é o diretório gerado por
# scripts/release/apk-manifest.mjs (com a pasta downloads/ dentro). O stage
# `web` do Dockerfile da raiz copia /downloads daqui para /srv/release/downloads.
# Imutável por versão; a tag `latest` aponta para a última publicada.
FROM scratch
LABEL org.opencontainers.image.source=https://github.com/visb/fonte
COPY downloads/ /downloads/
