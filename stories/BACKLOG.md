# Backlog

badge da ficha fora da planilha no import ainda diz "Arquivado" / "será importado como arquivado"
(`features/residents/constants.ts:255-257`) — depois da story 162 o texto está errado quando a ficha
tem casa reconhecível e entra ATIVA. Renomear para algo como "Fora da planilha".

---

infra de seed E2E de document_templates — não existe spec Playwright da aba de anexos do filho e o
`seed-test.ts` não cria nenhum template, então o ciclo "marcar todos → gerar PDF combinado → seleção
limpa" (story 161) ficou sem cobertura e2e. Seedar template obrigatório sem poluir as outras suítes.
