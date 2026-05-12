## grupos de apoio

1. No app adm, criar seção para gerenciar grupos de apoio.
   Grupos de apoio tem:

- Nome
- Nome da igreja
- Endereço
- coordenador(relação com servo)
- Dia da semana(integer), guardar o numero do dia da semana em q o grupo se repete
- historico de reunioes

2. No app ops, vamos criar um modulo para checkin das familias no grupo de oraçao.

Na primeira tela, deve mostrar:

- lista de reunioes, ordenadas por data, a reuniao do dia deve ser a primeira na lista;
- botão para criar uma nova reunião, os dados devem vir pre-preenchidos de acordo com as configurações do grupo, mas com a opção de poder mudar para casos excepcionais;

Ao clicar em uma reunião, exibir tela contendo:

- botão para acessar qr code q será usado pelas familias para escanear e realizar o checkin durante a reunião;
- input de autocomplete para buscar pelo nome do filho, para q o coordenador possa marcar manualmente presensa de familias q eventualmente nao tenham o app instalado;
- lista das familias que fizerem checkin no grupo(utilizar o nome do filho para identificar a familia);

Documente estas atualizaçoes para uso futuro junto ao claude
