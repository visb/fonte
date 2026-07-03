# Backlog

Tenho uma planilha q contem:

- nome
- cpf
- contato de familiar
- data de entrada
- data de saida
- historico de contribuição familiar

esta planilha é separada por abas, cada aba reperesenta uma casa. ignorar a aba "curso biblico".

a planilha está aqui: "lista-filhos.tsx" para referencia. Os dados nao estão atualizados, mas serve como referencia

Quero usar essa planilha para preencher os dados no import com IA.

Fazer uma interface onde eu faço primeiramente o upload desta planilha e outra uma area para ir adicionando a ficha dos filhos, com drag-drop ou click-to-open-files. Essa lista vai sendo processada em tempo real, no maximo 5 filhos por vez(deixar este numero de uma forma facil de mudar, talvez eu queira ajustar depois)
antes de importar um filho, deve verificar se ja nao existe um filho com o mesmo nome ou cpf e informar na interface caso haja conflito

O processamento deve ser acompanhado atraves da lista. depois de concluida a extração de cada item mostrar inline:

- foto de perfil, data de entrada, saida(se houver), casa atual(se ainda estiver interno);
- resumo da importação(se tudo ocorreu bem, se tem algum ~e quantos~ alerta, etc);
- botão para aprovar a importação;
- botao para abrir um modal e ver a ficha completa do filho, com todos os dados preenchiveis(modal deve conter tambem um botão para aprovar a importação);

Ao aprovar a importação, as informações devem ser persistidas no banco de dados

Caso haja algum conflito com filho ja importado, mostrar um alerta inline explicitando o conflito

---
