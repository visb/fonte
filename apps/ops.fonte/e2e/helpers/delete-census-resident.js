// Limpeza da fixture do census.yaml (story 209; story 182: ninguém deixa linha
// que criou). Acha o filho adicionado na contagem (CENSUS_ADDED) pelo nome único
// e o remove como ADMIN.
//
// Roda no motor JS do Maestro (`http`/`json` globais). Do emulador Android, o
// host da máquina é 10.0.2.2. Variáveis vindas do yaml: API_URL, NAME.
const base = API_URL;

const login = http.post(base + '/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'admin@fonte.com', password: 'admin123' }),
});
const auth = { Authorization: 'Bearer ' + json(login.body).accessToken };

const page = json(
  http.get(
    base + '/residents?status=CENSUS_ADDED&limit=100&search=' + encodeURIComponent(NAME),
    { headers: auth },
  ).body,
);
const list = page.data || page.items || page;
for (let i = 0; i < list.length; i++) {
  if (list[i].name === NAME) {
    http.delete(base + '/residents/' + list[i].id, { headers: auth });
  }
}
