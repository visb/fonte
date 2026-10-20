// Limpeza por id de fixture criada pelo próprio flow (story 182: ninguém deixa
// linha que criou). Remove o filho como ADMIN (soft delete).
//
// Roda no motor JS do Maestro. Variáveis vindas do yaml: API_URL, ID.
const login = http.post(API_URL + '/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'admin@fonte.com', password: 'admin123' }),
});
http.delete(API_URL + '/residents/' + ID, {
  headers: { Authorization: 'Bearer ' + json(login.body).accessToken },
});
