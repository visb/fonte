# Plan: Import em lote de filhos com planilha de referência (EPIC)

> **Status: PLANEJAMENTO.** Epic guarda-chuva. Implementar pelas stories-filhas
> [[101]]–[[105]], nesta ordem, cada uma em sua branch. Este arquivo é só o mapa.

## Context

Hoje o import de filho por IA processa **um `.docx` por vez** (`ImportResidentPage` →
`api.residents.parseDocx` → `DocxParserService`, que usa o Anthropic SDK + `mammoth`/`jszip` para
extrair a ficha e a foto). Para migrar o acervo histórico da casa, o usuário precisa importar
**muitos filhos de uma vez**, cruzando cada ficha com uma **planilha de referência** que já contém
os dados cadastrais e o histórico de contribuição.

A planilha (`stories/lista-filhos.xlsx`, dados desatualizados mas representativos):
- **Uma aba por casa** (o nome da aba é o nome da casa). **Ignorar a aba "curso biblico".**
- Colunas por linha: **nome, cpf, contato de familiar, data de entrada, data de saída,
  histórico de contribuição familiar** (meses/valores pagos).

Fluxo desejado (UI nova, no `adm.fonte`):
1. Upload da planilha de referência primeiro.
2. Área para ir adicionando as fichas `.docx` (drag-drop ou click-to-open), várias.
3. A lista é **processada em tempo real**, no **máximo 5 por vez** (número fácil de mudar).
4. Antes de importar, **checar conflito** por **nome ou CPF** contra filhos já cadastrados e avisar
   inline. Conflito com filho já importado nesta sessão também é sinalizado.
5. Concluída a extração de cada item, o card mostra inline: **foto, data de entrada, data de saída
   (se houver), casa atual (se ainda interno)**, **resumo da importação** (ok / quantos alertas),
   **botão aprovar**, e **botão para modal com a ficha completa editável** (o modal também tem
   aprovar).
6. **Aprovar → persiste no banco** (resident + relatives + contribuições retroativas).

### Decisões travadas

- **Planilha enriquece a extração (cross-match).** Ao extrair cada ficha, casa por **nome
  (normalizado, sem acento — reusar util da story [[32]]) ou CPF** com a linha da planilha e
  preenche/prioriza: data de entrada, data de saída, contato familiar, histórico de contribuição.
  A planilha é a fonte de verdade desses campos; a ficha `.docx` traz o resto + a foto.
- **Fichas = `.docx`** (mesmo formato do `parseDocx` atual), em lote.
- **Histórico de contribuição é PERSISTIDO** como lançamentos retroativos, reusando a lógica de
  `ResidentFollowUpService.bulkCreateContributions` (endpoint já existente
  `POST /residents/:id/follow-ups/bulk-contributions`, DTO `BulkCreateContributionsDto` = lista de
  meses). O commit do import deve criar essas contribuições na mesma transação.
- **Batch size configurável** — constante no front (`IMPORT_BATCH_SIZE = 5`) fácil de ajustar.
- **Entrega em epic + stories-filhas** (abaixo).

### Reuso já existente (não duplicar)

- `DocxParserService.parseDocx(buffer)` → `{ resident, relatives, warnings, houseName, rawText,
  photoBase64 }`. Estender, não reescrever.
- `POST /residents/import/parse-docx` (ADMIN, COORDINATOR).
- `ResidentReceivableService` / `ResidentFollowUpService.bulkCreateContributions` para contribuições.
- Wizard de import atual (`features/residents/components/import/*`, `ResidentFormSections`) —
  reaproveitar os campos/labels no modal da ficha completa.
- Normalização de nome sem acento (story [[32]]) para o match e a checagem de conflito.

## Stories-filhas

| Story | Camada | Entrega |
|---|---|---|
| [[101]] | Backend | Parse da planilha `.xlsx` → linhas normalizadas por casa (ignora "curso biblico") |
| [[102]] | Backend | Cross-match planilha × ficha + enriquecimento da extração `parseDocx` |
| [[103]] | Backend | Checagem de conflito (nome/CPF) + endpoint de commit atômico do import |
| [[104]] | Frontend | Tela de import em lote: upload planilha + drag-drop `.docx` + fila (batch 5) + cards inline |
| [[105]] | Frontend | Modal da ficha completa editável + aprovação/persistência + alerta de conflito |

Dependências: 102 depende de 101; 103 independe mas alimenta o commit; 104 depende de 101+102;
105 depende de 103+104.

## Validação (do epic)

Cada filha traz sua própria Validação com **gate de cobertura** (código novo sem teste não fecha a
story; `pnpm test:api:cov` no backend e runner de cobertura do `adm.fonte` no front; sem
`skip`/`only`/`xfail` injustificado). O epic só fecha quando todas as filhas fecharem e o fluxo
ponta-a-ponta (upload planilha → arrastar N fichas → aprovar → filhos + contribuições no banco)
estiver coberto por um E2E do `adm.fonte`.

## Fora de escopo (do epic)

- Fichas em imagem/PDF (só `.docx`).
- Importar direto das linhas da planilha sem `.docx` (a ficha é obrigatória — traz a foto e o resto).
- Reconciliação/atualização de filhos já existentes (conflito só **avisa e bloqueia**, não faz merge).
- Configurar o batch size ou o mapeamento de colunas da planilha pela UI.
