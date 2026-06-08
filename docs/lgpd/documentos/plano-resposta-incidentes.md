# Plano de Resposta a Incidentes de Segurança

> MINUTA — art. 48 da LGPD. Documento interno.
> Versão: `1.0`

## Objetivo

Definir como a Comunidade Fonte de Misericórdia detecta, contém, avalia e comunica incidentes de segurança que possam acarretar risco ou dano relevante aos titulares.

## Definição

Incidente de segurança = qualquer evento que comprometa a confidencialidade, integridade ou disponibilidade de dados pessoais (vazamento, acesso não autorizado, perda, ransomware, exposição indevida de CPF/dados de saúde etc.).

## Papéis

- **Encarregado (DPO):** `[nome]` — coordena a resposta e a comunicação à ANPD/titulares.
- **Responsável técnico (TI):** `[nome]` — contém e investiga tecnicamente.
- **Coordenação:** decisões operacionais e apoio.

## Fluxo de resposta

1. **Detecção e registro** — qualquer pessoa que identificar o incidente comunica o Encarregado imediatamente. Registrar data/hora, o que ocorreu, dados afetados.
2. **Contenção** — TI isola o sistema/credencial afetada; revoga acessos; preserva evidências e logs de auditoria.
3. **Avaliação de risco** — Encarregado avalia: categorias e volume de dados, sensibilidade (saúde/religião agravam), facilidade de identificação, consequências aos titulares.
4. **Comunicação à ANPD e titulares (art. 48)** — se houver risco/dano relevante, comunicar em **prazo razoável** (referência: até 3 dias úteis da ciência), informando: natureza dos dados, titulares afetados, medidas técnicas adotadas, riscos e medidas de mitigação.
5. **Remediação** — corrigir a causa raiz; aplicar melhorias; atualizar o ROPA e o `../DIAGNOSTICO_LGPD.md` se necessário.
6. **Registro pós-incidente** — relatório arquivado pelo Encarregado, com lições aprendidas.

## Canais de comunicação ao titular

Contato direto (telefone/e-mail cadastrado) e/ou aviso no `[local/URL]`.

## Prevenção

Medidas técnicas das Fases 1–4 do `../ROADMAP_LGPD.md`: controle de acesso por perfil, escopo por casa, audit log, rate-limit, minimização de PII, backup, retenção/descarte.
