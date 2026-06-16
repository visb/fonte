# Plan: [EPIC] Notas do curso bíblico (módulos + provas/trabalhos)

> **Status: PLANEJAMENTO.** Story-pai (epic). Não implementar este arquivo diretamente —
> coordena as stories-filhas [[34]] e [[35]]. Implementar só após o usuário aprovar.

## Context

No curso bíblico, hoje só existe turma (`bible_course_classes`) + matrícula de filhos
(`bible_course_enrollments`). Falta uma área para **organizar notas de provas e trabalhos** de
forma dinâmica. O curso é dividido em **módulos**. O usuário ainda não tem a estrutura completa
de módulos em mãos — o conteúdo dos módulos será cadastrado pelo próprio admin (a CRUD do
catálogo resolve isso; ver [[34]]).

### Decisões do usuário (travadas — respostas do levantamento)

- **Módulos = catálogo compartilhado.** Cadastrados uma vez e reusados em toda turma. NÃO são
  por-turma. Ex.: "Gênesis", "Êxodo"... vivem num catálogo global. → [[34]].
- **Avaliações fixas por módulo: prova + trabalho.** Cada módulo tem exatamente duas notas por
  aluno: nota de prova e nota de trabalho. Sem avaliações dinâmicas/extras nesta fase.
- **Escala numérica 0–10.** Nota decimal (uma casa), 0 a 10. Médias calculadas. → [[35]].
- **Permissão: ADMIN só.** Apenas administradores lançam/editam notas e gerenciam o catálogo de
  módulos. (Coordenador/servo ficam de fora desta fase.)

### Por que catálogo compartilhado + avaliações fixas

Catálogo compartilhado evita recadastrar os módulos a cada turma e mantém relatórios
comparáveis entre turmas. Avaliações fixas (prova/trabalho) mantêm o modelo de dados simples
agora — se no futuro precisar de avaliações dinâmicas, migra-se a coluna fixa para uma tabela
`assessments` sem quebrar o histórico (anotado em Fora de escopo).

## Desenho geral (modelo de dados)

```
bible_course_modules          (catálogo compartilhado)
  id, name, sequence (ordem de exibição), notes?, created_at, updated_at, deleted_at

bible_course_grades           (nota de um aluno num módulo)
  id, enrollment_id  → bible_course_enrollments
      module_id      → bible_course_modules
      exam_grade     numeric(4,2) NULL   (prova, 0–10)
      work_grade     numeric(4,2) NULL   (trabalho, 0–10)
      created_at, updated_at, deleted_at
  UNIQUE (enrollment_id, module_id)  -- 1 linha por aluno×módulo
```

- A nota vincula-se à **matrícula** (`enrollment`), não direto ao resident — assim a nota
  pertence à turma certa e some junto se a matrícula for removida.
- Média por módulo = média(prova, trabalho) ignorando nulos; média do aluno na turma = média das
  médias de módulo. Cálculo no backend (service), exibição na grade. Detalhe de regra de
  aprovação fica em [[35]].

## Stories-filhas

1. **[[34]] — Catálogo de módulos do curso bíblico.** Backend (entity/migration/DTO/endpoints
   CRUD ADMIN) + tela de gestão no `adm.fonte`. Base para tudo.
2. **[[35]] — Lançamento de notas (prova/trabalho) por módulo.** Backend (grades
   entity/migration/endpoints, médias) + grade de lançamento na tela de detalhe da turma
   (`BibleClassDetailPage`) no `adm.fonte`.

Ordem: 34 antes de 35 (35 referencia módulos do catálogo).

## Validação (do epic)

- Cada filha tem sua própria seção de validação. Epic só fecha quando 34 e 35 estiverem verdes e
  o fluxo end-to-end (cadastrar módulo → lançar prova/trabalho → ver média) funcionar.

## Fora de escopo (desta fase do epic)

- Avaliações dinâmicas/extras por módulo (peso, múltiplas provas). Modelo atual permite migrar
  depois sem perder histórico.
- Escala configurável (0–100, conceito A–E). Fixado 0–10.
- Lançamento por coordenador/servo. Só ADMIN.
- Boletim/PDF, exportação, frequência/presença no curso.
- Visualização de notas pelo familiar (`app.fonte`) ou interno (`resident.fonte`).
