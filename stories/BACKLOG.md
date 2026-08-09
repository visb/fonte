# Backlog

infra de seed E2E de document_templates — não existe spec Playwright da aba de anexos do filho e o
`seed-test.ts` não cria nenhum template, então o ciclo "marcar todos → gerar PDF combinado → seleção
limpa" (story 161) ficou sem cobertura e2e. Seedar template obrigatório sem poluir as outras suítes.
