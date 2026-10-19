#!/bin/sh
# Habilita os server blocks opcionais (sites-available/<host>.conf) cujo
# certificado já foi emitido, e desabilita os que ainda não têm (story 213).
#
# Por quê: `ssl_certificate` apontando para arquivo inexistente impede o nginx
# de subir. Um host novo chega à produção pelo deploy automático da main antes
# de o certificado dele ser emitido (passo manual do README §9.7); sem este
# guarda, o host novo derrubaria todos os outros.
#
# Roda (1) no boot via /docker-entrypoint.d (CMD padrão da imagem) e (2) no
# `command` do docker-compose.prod.yml, no boot e antes de cada `nginx -s reload`
# — então o host entra sozinho em até 6h depois do certbot, ou na hora com
# `docker compose -f docker-compose.prod.yml restart nginx`.
set -eu

AVAILABLE=/etc/nginx/sites-available
ENABLED=/etc/nginx/sites-enabled
LIVE=/etc/letsencrypt/live

mkdir -p "$ENABLED"

for conf in "$AVAILABLE"/*.conf; do
  [ -e "$conf" ] || continue
  host=$(basename "$conf" .conf)
  if [ -f "$LIVE/$host/fullchain.pem" ] && [ -f "$LIVE/$host/privkey.pem" ]; then
    ln -sf "$conf" "$ENABLED/$host.conf"
    echo "[fonte-nginx] $host habilitado"
  else
    rm -f "$ENABLED/$host.conf"
    echo "[fonte-nginx] $host sem certificado em $LIVE/$host: server 443 desabilitado"
  fi
done
