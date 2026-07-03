# Plan: Remover a planilha de referência e purgá-la do histórico do git

> **Status: PLANEJAMENTO.** Depende de [[105]] — só executar **depois** que o epic [[100]] estiver
> concluído (todas as filhas 101–105 implementadas e mergeadas). Implementar após aprovação.

## Context

Para desenvolver o epic [[100]] (import em lote), a planilha real `stories/lista-filhos.xlsx` foi
commitada no repositório (commit `566ed97`) como referência de formato. **Ela contém dados pessoais
reais** — nome, CPF, contato de familiar, histórico de contribuição — de filhos da casa. Manter esse
arquivo versionado é um passivo de LGPD (ver `docs/lgpd/DIAGNOSTICO_LGPD.md`): PII sensível fica na
história do git, replicada em todo clone e no remoto, mesmo após `git rm`.

Esta story **encerra esse passivo**: remove a planilha do working tree **e** a expurga de toda a
história do git, de forma que ela não apareça em nenhum commit.

### Pré-condição travada

- **Só rodar depois da [[105]]**, pois as stories 101–104 usam a planilha como referência de formato
  durante a implementação. Antes disso, a planilha precisa existir. Ao concluir a [[105]], a
  referência não é mais necessária no repositório.
- Substituir, se ainda for útil como fixture de teste, por uma **versão anonimizada** (CPFs/nomes
  fake) — decisão registrada abaixo.

### Decisões travadas

- **Reescrita de história é destrutiva e coordenada.** Exige `force-push` e re-clone por todos os
  colaboradores. Não executar sozinho no meio de outras branches abertas — combinar janela.
- A(s) fixture(s) que o teste da [[101]] precisar devem ser **anonimizadas** e commitadas em
  `services/api/test/fixtures/`, **não** a planilha real. Se a [[101]] já criou uma fixture
  anonimizada, esta story só remove a real.

## Desenho

### 1. Remover do working tree

- `git rm stories/lista-filhos.xlsx` (ou já removida por outra story) e commitar.
- Adicionar padrão ao `.gitignore` para impedir re-commit acidental (ex: `lista-filhos.xlsx`,
  `stories/*.xlsx` — ajustar para não bloquear fixtures anonimizadas em `test/fixtures/`).

### 2. Expurgar da história

- Ferramenta: **`git filter-repo`** (preferida; `git-filter-branch` é legado e frágil). Alternativa
  `BFG Repo-Cleaner`.
- Comando de referência (rodar em clone espelho, revisar antes):
  ```bash
  git filter-repo --path stories/lista-filhos.xlsx --invert-paths
  ```
- Conferir que o blob sumiu: `git log --all --oneline -- stories/lista-filhos.xlsx` deve vir vazio;
  `git rev-list --all --objects | grep lista-filhos` sem resultado.

### 3. Publicar e coordenar

- `git push --force-with-lease` para todos os refs afetados (main e quaisquer branches).
- Avisar colaboradores: a história foi reescrita → **re-clonar** (ou `git fetch` + reset), pois os
  hashes mudam.
- Se o remoto for GitHub e houver PRs/forks abertos referenciando os commits antigos, tratar caso a
  caso.

### 4. Registro LGPD

- Anotar a remoção no `docs/lgpd/DIAGNOSTICO_LGPD.md` (item de PII em repositório → resolvido) e, se
  aplicável, no `ROADMAP_LGPD.md`.

## Validação

Esta story **não tem código de aplicação** — a validação é operacional/verificação, não teste
unitário (o gate de cobertura não se aplica; não há lógica nova de app).

- `git log --all --oneline -- stories/lista-filhos.xlsx` → **sem commits**.
- `git rev-list --all --objects | grep -i lista-filhos` → **sem saída**.
- `git cat-file -e <blob-antigo>` → objeto ausente (após gc/expire no remoto).
- Suíte da API segue verde (`pnpm test:api`) usando **fixture anonimizada**, não a planilha real —
  confirmar que nenhum teste referencia `stories/lista-filhos.xlsx`.
- `.gitignore` impede re-adicionar o arquivo real (`git status` limpo após recolocar o arquivo local).

## Fora de escopo

- Anonimização/criação da fixture de teste (é responsabilidade da [[101]]; aqui só se garante que a
  real não fica no lugar dela).
- Rotação de qualquer segredo — o arquivo é PII, não credencial; não há token a revogar.
- Reescrita de história de outros arquivos.
