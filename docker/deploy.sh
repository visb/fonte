#!/bin/sh
# Deploy no VPS: puxa as imagens novas do GHCR e recria os serviços.
#
# É o ÚNICO comando que a chave SSH do GitHub Actions consegue executar — o
# authorized_keys do VPS a amarra a este script por `command=`, então a chave
# não abre shell nem roda outra coisa. Instalação em README.md (§ 9.7).
#
# Deliberadamente sem parâmetro: o Actions não escolhe o que rodar. Sempre
# `latest`, que é a tag que o job `images` acabou de publicar. Para voltar a uma
# versão anterior, use a tag de SHA à mão no servidor:
#   IMAGE_TAG=<sha> docker compose -f docker-compose.prod.yml up -d
set -eu

cd /opt/fonte

echo "==> pull"
docker compose -f docker-compose.prod.yml pull api nginx

echo "==> up"
# Só api e nginx: postgres, minio e certbot não vêm do registry e recriá-los
# derrubaria banco e storage sem necessidade.
docker compose -f docker-compose.prod.yml up -d api nginx

echo "==> estado"
docker compose -f docker-compose.prod.yml ps

# As imagens antigas acumulam rápido (a da API tem ~2,8 GB) e o disco é de 48 GB.
echo "==> limpeza"
docker image prune -f

echo "==> ok"
