// Fixture do reacolhimento no census.yaml (story 218): um filho que JÁ PASSOU
// pela comunidade (alta registrada), criado na casa do coordenador. O seed fica
// intacto (story 182) — o filho é removido no fim por delete-resident.js.
//
// Roda no motor JS do Maestro (`http`/`json`/`output` globais). Variáveis vindas
// do yaml: API_URL, NAME. Devolve o id em `output.readmitResidentId`.
const base = API_URL;

function loginAs(identifier, password) {
  const res = http.post(base + '/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: identifier, password: password }),
  });
  return { Authorization: 'Bearer ' + json(res.body).accessToken, 'Content-Type': 'application/json' };
}

const coord = loginAs('coord@fonte.com', 'coord123');
const houseId = json(http.get(base + '/staff/me', { headers: coord }).body).houseId;

const admin = loginAs('admin@fonte.com', 'admin123');
const created = json(
  http.post(base + '/residents', {
    headers: admin,
    body: JSON.stringify({
      name: NAME,
      houseId: houseId,
      gender: 'MALE',
      status: 'ACTIVE',
      entryDate: '2025-01-10',
    }),
  }).body,
);
http.patch(base + '/residents/' + created.id, {
  headers: admin,
  body: JSON.stringify({ status: 'DISCHARGED', exitDate: '2025-03-01' }),
});
output.readmitResidentId = created.id;
