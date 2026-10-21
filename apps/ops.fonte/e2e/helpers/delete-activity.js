// Limpeza da fixture do activities.yaml (story 182: ninguém deixa linha que
// criou). Acha a atividade pelo título único e a exclui como ADMIN: desde a
// story 220 o fluxo termina com a atividade aprovada (A fazer), e o criador só
// exclui o próprio rascunho.
//
// Roda no motor JS do Maestro (`http`/`json` globais). Do emulador Android, o
// host da máquina é 10.0.2.2. Variáveis vindas do yaml: API_URL, TITLE.
const base = API_URL;

const login = http.post(base + '/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'admin@fonte.com', password: 'admin123' }),
});
const auth = { Authorization: 'Bearer ' + json(login.body).accessToken };

const list = json(http.get(base + '/activities', { headers: auth }).body);
for (let i = 0; i < list.length; i++) {
  if (list[i].title === TITLE) {
    http.delete(base + '/activities/' + list[i].id, { headers: auth });
  }
}
