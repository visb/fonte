#!/bin/bash
set -e

cd "$(dirname "$0")/.."

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

echo "==> Subindo frontend de testes (porta 5174)..."
cd apps/adm.fonte
npx vite --mode test --port 5174 &
FRONTEND_PID=$!
cd ../..

echo "==> Aguardando serviços ficarem prontos..."
# Aguarda API
for i in $(seq 1 30); do
  curl -sf http://localhost:3001/api/v1 > /dev/null 2>&1 && break || true
  sleep 2
done

# Aguarda frontend
for i in $(seq 1 20); do
  curl -sf http://localhost:5174 > /dev/null 2>&1 && break || true
  sleep 2
done

echo "==> Rodando testes E2E..."
cd apps/adm.fonte
npx playwright test
TEST_EXIT=$?
cd ../..

echo "==> Encerrando serviços..."
kill $API_PID $FRONTEND_PID 2>/dev/null || true

exit $TEST_EXIT
