# Documentos LGPD — Comunidade Fonte de Misericórdia

> ⚠️ **MINUTAS.** Estes documentos são modelos de trabalho. **Devem ser revisados e validados por advogado/jurídico** antes de qualquer uso oficial. Não substituem parecer jurídico.
>
> Campos entre colchetes `[...]` são placeholders a preencher (CNPJ, endereço, nome do Encarregado, e-mail de contato, datas).

## Identificação do Controlador

- **Razão social / nome:** Comunidade Fonte de Misericórdia
- **CNPJ:** `[CNPJ]`
- **Endereço:** `[endereço completo]` — Itaperuçu/PR
- **Encarregado (DPO):** `[nome]` — `[e-mail de contato]`

## Documentos

| # | Documento | Artigo LGPD | Finalidade |
|---|---|---|---|
| 1 | `politica-de-privacidade.md` | art. 9 | Transparência geral; bases legais; direitos do titular |
| 2 | `aviso-de-privacidade-acolhimento.md` | art. 9 | Cláusula a inserir na ficha de acolhimento (ponto de coleta) |
| 3 | `termo-consentimento-uso-imagem.md` | art. 7, 11 | Consentimento p/ uso de imagem/divulgação (upgrade LGPD) |
| 4 | `termo-consentimento-dados-sensiveis.md` | art. 11 | Consentimento p/ divulgação religiosa/testemunho + responsável |
| 5 | `registro-operacoes-tratamento-ROPA.md` | art. 37 | Registro das operações de tratamento |
| 6 | `politica-retencao-descarte.md` | art. 15, 16 | Prazos de guarda e descarte/anonimização |
| 7 | `plano-resposta-incidentes.md` | art. 48 | Procedimento de resposta a incidente de segurança |
| 8 | `ato-nomeacao-encarregado.md` | art. 41 | Nomeação formal do Encarregado/DPO |

## Base legal por processo

Ver `../DIAGNOSTICO_LGPD.md` §5. Resumo: saúde/dependência sob **tutela da saúde**; consentimento só para **imagem/divulgação e divulgação religiosa**.

## O que estes documentos NÃO resolvem

Conformidade plena exige também as medidas técnicas do `../ROADMAP_LGPD.md`:
- **Fase 1** — segurança de acesso (rate-limit login, escopo por casa, audit log, minimização de CPF/RG).
- **Fase 3** — direitos do titular implementados no sistema (export, anonimização).
- **Fase 4** — retenção/descarte automatizados, limpeza de arquivos órfãos.

Documento sem a medida técnica correspondente é conformidade só no papel.
