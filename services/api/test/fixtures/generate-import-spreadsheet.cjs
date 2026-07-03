/*
 * Gera a fixture ANONIMIZADA `import-residents.xlsx` usada pelos testes do parser
 * de planilha (story 101). Reproduz o layout da planilha real de referência
 * (`stories/lista-filhos.xlsx`) — uma aba por casa, cabeçalho com Nome/Chegada/
 * Telefone/CPF/Saída + colunas "MENSALIDADE MÊS N" — mas com nomes e CPFs FAKE.
 * Inclui a aba "Curso Bíblico" a ser ignorada e linhas de rodapé sem nome/cpf
 * para exercitar a contagem `skipped`.
 *
 * Rodar:  node services/api/test/fixtures/generate-import-spreadsheet.cjs
 */
const path = require('path');
const ExcelJS = require(require.resolve('exceljs', { paths: [path.join(__dirname, '../../../..')] }));

const OUT = path.join(__dirname, 'import-residents.xlsx');
const d = (y, m, day) => new Date(Date.UTC(y, m - 1, day));

async function main() {
  const wb = new ExcelJS.Workbook();

  // ── Casa Um: cabeçalho completo + colunas de contribuição ────────────────────
  const casaUm = wb.addWorksheet('Casa Um');
  casaUm.addRow([
    'Nome:',
    'Chegada:',
    'Telefone:',
    'C.P.F.',
    'Saída:',
    'STATUS ACOLHIMENTO',
    'MENSALIDADE MÊS 1',
    'MENSALIDADE MÊS 2',
    'MENSALIDADE MÊS 3',
  ]);
  // MÊS 1 e MÊS 2 pagos → entryDate 2024-01-15 → [2024-01-01, 2024-02-01]
  casaUm.addRow([
    'João da Silva',
    d(2024, 1, 15),
    '998877665',
    '111.222.333-44',
    d(2024, 6, 20),
    'consagrado',
    'PAGO 700,00',
    'PAGO 700,00',
    '',
  ]);
  // MÊS 1 e MÊS 3 preenchidos, entrada 2023-11 → rollover de ano [2023-11-01, 2024-01-01]
  casaUm.addRow([
    'María José Conceição',
    d(2023, 11, 5),
    '984111222',
    '555.666.777-88',
    '',
    'somando',
    'CESTAS',
    '',
    'PAGO 500,00',
  ]);
  // Linha só com nome (sem cpf) → mantida, cpf null, sem contribuições (sem entrada)
  casaUm.addRow(['Pedro Sem Documento', '', '', '', '', 'aguardando', '', '', '']);
  // Linha só com cpf (sem nome) → mantida, name/nameNormalized null
  casaUm.addRow(['', d(2024, 3, 10), '', '000.111.222-33', '', '', '', '', '']);
  // Rodapé sem nome e sem cpf → descartada (skipped)
  casaUm.addRow(['', '', '', '', '', 'TOTAL', '', '', '']);

  // ── Casa Dois: cabeçalho com acento/caixa diferentes, sem contribuição ───────
  const casaDois = wb.addWorksheet('Casa Dois');
  casaDois.addRow(['NOME', 'Data de Entrada', 'Contato Familiar', 'CPF', 'Data de Saída']);
  // Data de entrada como STRING dd/mm/yyyy → exercita o parse de string
  casaDois.addRow(['Ângela Núñez', '02/03/2024', '47990001111', '123.456.789-09', '']);
  // Outra linha de rodapé vazia → skipped
  casaDois.addRow(['', '', '', '', '']);

  // ── Curso Bíblico: deve ser ignorada por completo ────────────────────────────
  const curso = wb.addWorksheet('Curso Bíblico');
  curso.addRow(['Nome:', 'Chegada:', 'Telefone:', 'C.P.F.']);
  curso.addRow(['Não Deve Aparecer', d(2024, 1, 1), '999999999', '999.888.777-66']);

  await wb.xlsx.writeFile(OUT);
  console.log('Fixture escrita em', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
