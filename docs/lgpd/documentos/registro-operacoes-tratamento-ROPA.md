# Registro das Operações de Tratamento de Dados (ROPA)

> MINUTA — art. 37 da LGPD. Documento interno, mantido pelo Controlador/Encarregado e atualizado a cada nova operação.
> Versão: `1.0` — Última atualização: `[data]`

## Controlador

Comunidade Fonte de Misericórdia — CNPJ `[CNPJ]` — Encarregado: `[nome]` (`[contato]`).

## Operações

| # | Operação | Categorias de dados | Categorias de titulares | Base legal | Finalidade | Compartilhamento | Retenção |
|---|---|---|---|---|---|---|---|
| 1 | Cadastro/acolhimento | Identificação (nome, CPF, RG, endereço, contato) | Internos | Execução de contrato; proteção da vida | Admissão e gestão do acolhimento | Operador de TI (hospedagem) | Ver Política de Retenção |
| 2 | Prontuário e acompanhamento | Saúde, medicação, dependência química | Internos | Tutela da saúde; proteção da vida | Tratamento e acompanhamento clínico/social | Unidades de saúde (encaminhamento) | Prazo legal de registros de saúde |
| 3 | Controle de medicamentos | Saúde, medicação contínua | Internos | Tutela da saúde | Administração segura de medicação | — | Prazo legal de registros de saúde |
| 4 | Gestão de familiares | Nome, telefone, parentesco | Familiares/responsáveis | Legítimo interesse; execução contratual | Comunicação e visitas | — | Enquanto durar o vínculo + prazo legal |
| 5 | Acesso ao sistema | Login, registros de acesso, auditoria | Staff, internos, familiares | Legítimo interesse e segurança | Segurança da informação e auditoria | Operador de TI | `[prazo de logs]` |
| 6 | Emissão fiscal | CPF, dados financeiros | Internos/responsáveis | Obrigação legal | Documentos fiscais | Contabilidade; Fisco | Prazo da legislação tributária |
| 7 | Divulgação de imagem | Imagem, voz, depoimento | Internos | Consentimento | Divulgação institucional/religiosa, captação | Público (mídias) | Até revogação |
| 8 | Divulgação religiosa | Religião, testemunho | Internos | Consentimento explícito | Testemunho e divulgação religiosa | Público (mídias) | Até revogação |

## Medidas de segurança aplicadas

Controle de acesso por perfil (RBAC), escopo por casa, senhas com hash (bcrypt), registro de auditoria, backup criptografado/retido, comunicação criptografada (HTTPS). Detalhe e lacunas em `../DIAGNOSTICO_LGPD.md` e `../ROADMAP_LGPD.md`.

## Transferência internacional

`[Indicar se há — ex.: provedor de nuvem/bucket fora do Brasil. Se sim, registrar país e salvaguardas.]`
