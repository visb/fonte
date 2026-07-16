# Backlog

## sugestões de matriculas para novas turmas do curso biblico

- ignorar na listagem filhos q ja passaram pelo curso biblico.
- adicionar botão "ja fez" para remover o filho para sempre dessa lista de sugestao

## assinatura de documentos vinculada ao usuario logado no admin

- adicionar field "asinatura" no editor de documentos. Este field, ao gerar o documento, deve inserir a assinatura do usuario logado
- o espaço reservado para assinatura deve conter uma linha de demarcação, composta de 25x"\_".
- ao gerar documento, se a assinatura para o usuario nao estiver configurada, deve exibir modal para configuração da mesma
- a assinatura pode ser configurada no menu de perfil do usuario logado

---

## ordenação na listagem de filhos

- mudar ordenação padrao para ordenar pela data de entrada, com os mais recentes aparecendo primeiro
- criar um select de ordenaçao na listagem, junto com os filtros

## preferencias do usuario

- criar mecanismo para salvar preferencias gerais do sistema
- persistir os filtros no banco de dados, numa nova entidade "preferencias"(em ingles).
- ao fazer login, carregar estas preferencias no localStorage e ao setar novas preferencias, persistir em ambos(banco e local storage)
- persistir neste sistema de preferencias, os filtros da tela de listagem de filhos, exceto o valor do campo "buscar", este deve estar presente apenas na URL. os filtros persistido no sistema de preferencias devem ser sobrepostos pelos filtros passadas na URL
