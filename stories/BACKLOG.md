# Backlog

## ordenação na listagem de filhos

- mudar ordenação padrao para ordenar pela data de entrada, com os mais recentes aparecendo primeiro
- criar um select de ordenaçao na listagem, junto com os filtros

## preferencias do usuario

- criar mecanismo para salvar preferencias gerais do sistema
- persistir os filtros no banco de dados, numa nova entidade "preferencias"(em ingles).
- ao fazer login, carregar estas preferencias no localStorage e ao setar novas preferencias, persistir em ambos(banco e local storage)
- persistir neste sistema de preferencias, os filtros da tela de listagem de filhos, exceto o valor do campo "buscar", este deve estar presente apenas na URL. os filtros persistido no sistema de preferencias devem ser sobrepostos pelos filtros passadas na URL
