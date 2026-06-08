# Política de Retenção e Descarte de Dados

> MINUTA — art. 15 e 16 da LGPD. Documento interno. Os prazos legais devem ser confirmados pelo jurídico.
> Versão: `1.0`

## Princípio

Dados pessoais são mantidos apenas pelo tempo necessário ao cumprimento da finalidade que justificou sua coleta, ou pelo prazo exigido por lei. Encerrada a finalidade e o prazo legal, os dados são **eliminados** ou **anonimizados**.

## Tabela de retenção

| Categoria | Prazo de guarda | Ação ao fim do prazo | Base |
|---|---|---|---|
| Cadastro do interno (identificação) | Duração do acolhimento + `[prazo legal — confirmar]` | Anonimização | Execução contratual |
| Prontuário / dados de saúde | `[prazo legal de registros de saúde — confirmar com jurídico]` | Eliminação ou anonimização | Tutela da saúde |
| Dados fiscais/financeiros | Prazo da legislação tributária (em regra 5 anos) | Eliminação | Obrigação legal |
| Dados de familiares/responsáveis | Enquanto durar o vínculo + `[prazo]` | Eliminação | Legítimo interesse |
| Registros de acesso/auditoria | `[ex.: 6 meses a 1 ano]` | Eliminação | Segurança (art. 16, I) |
| Imagem/depoimento (consentimento) | Até a revogação do consentimento ou fim da finalidade | Eliminação dos materiais futuros | Consentimento |
| Dados religiosos para divulgação | Até a revogação | Eliminação | Consentimento explícito |

## Procedimento de descarte

1. Identificação periódica (rotina semestral) de registros vencidos pelo Encarregado.
2. Para registros sob soft delete: aplicar **anonimização** (pseudonimização irreversível dos campos identificadores) preservando o que a lei exige reter.
3. Eliminação dos arquivos correspondentes no bucket (fotos, documentos, anexos).
4. Registro da operação de descarte no log de auditoria.

## Exceções (art. 16)

Dados podem ser conservados além do prazo para: cumprimento de obrigação legal/regulatória; estudo por órgão de pesquisa (anonimizados); exercício regular de direitos em processo; uso exclusivo do controlador, vedado o acesso de terceiros, desde que anonimizados.

## Implementação técnica

Os mecanismos de soft delete, anonimização e limpeza de bucket são tratados na **Fase 4** do `../ROADMAP_LGPD.md`.
