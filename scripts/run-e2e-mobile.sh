#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# -------------------------------------------------------
# Pré-requisito: emulador Android rodando e app instalado.
# Primeira vez: pnpm --filter ops.fonte android
# -------------------------------------------------------

echo "==> Resetando banco de testes..."
cd services/api
NODE_ENV=test npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
npx ts-node src/database/seed-test.ts
cd ../..

echo "==> Subindo API de testes (porta 3001)..."
cd services/api
NODE_ENV=test npx nest start &
API_PID=$!
cd ../..

echo "==> Aguardando API ficar pronta..."
for i in $(seq 1 30); do
  curl -sf http://localhost:3001/api/v1 > /dev/null 2>&1 && break || true
  sleep 2
done

echo "==> Subindo Expo com API de testes..."
cd apps/ops.fonte
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api/v1 npx expo start --android --no-dev &
EXPO_PID=$!
cd ../..

echo "==> Aguardando app carregar (30s)..."
sleep 30

echo "==> Rodando testes Maestro..."
maestro test apps/ops.fonte/e2e/
TEST_EXIT=$?

echo "==> Encerrando serviços..."
kill $API_PID $EXPO_PID 2>/dev/null || true

exit $TEST_EXIT
