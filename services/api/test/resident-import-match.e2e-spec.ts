import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';
import { DocxParserService } from '../src/modules/resident/docx-parser.service';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// A extração da ficha usa a IA (Anthropic) e não há chave/documento real no
// ambiente de teste, então o DocxParserService é stubado. Assim testamos o
// fluxo real do endpoint (guard, parse das rows, cross-match e enriquecimento)
// sem chamar API externa. A lógica de match tem cobertura própria no unit
// import-match.service.spec.ts.
const docxStub = {
  parseDocx: jest.fn().mockResolvedValue({
    resident: { name: 'João da Silva', cpf: '111.222.333-44', entryDate: '2020-01-01' },
    relatives: [],
    warnings: {},
    houseName: 'Casa da Ficha',
    rawText: 'texto',
    photoBase64: null,
  }),
};

const ROWS = [
  {
    houseName: 'Casa Um',
    name: 'João da Silva',
    nameNormalized: 'joao da silva',
    cpf: '11122233344',
    familyContact: '(47)98403-7330',
    entryDate: '2023-08-03',
    exitDate: null,
    contributionMonths: ['2023-08-01', '2023-09-01'],
  },
];

describe('Resident import — parse docx with spreadsheet (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let servantToken: string;

  beforeAll(async () => {
    app = await bootstrapApp({ overrideProvider: { token: DocxParserService, useValue: docxStub } });
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('ADMIN: docx + rows → 200 com matchStatus e campos enriquecidos', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-docx-with-spreadsheet`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('rows', JSON.stringify(ROWS))
      .attach('file', Buffer.from('fake docx'), { filename: 'ficha.docx', contentType: DOCX_MIME })
      .expect(201);

    expect(res.body.matchStatus).toBe('matched');
    expect(res.body.matchedHouseName).toBe('Casa Um');
    // a planilha é fonte de verdade da data de entrada (divergência → warning)
    expect(res.body.resident.entryDate).toBe('2023-08-03');
    expect(res.body.warnings.entryDate).toBeDefined();
    expect(res.body.contributionMonths).toEqual(['2023-08-01', '2023-09-01']);
    // familyContact virou um relative de contato
    expect(res.body.relatives).toHaveLength(1);
    expect(res.body.relatives[0].phone).toBe('(47)98403-7330');
  });

  it('SERVANT sem permissão → 403', () =>
    request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-docx-with-spreadsheet`)
      .set('Authorization', `Bearer ${servantToken}`)
      .field('rows', JSON.stringify(ROWS))
      .attach('file', Buffer.from('fake docx'), { filename: 'ficha.docx', contentType: DOCX_MIME })
      .expect(403));

  it('rows malformado (não é JSON) → 400', () =>
    request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-docx-with-spreadsheet`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('rows', 'não é json')
      .attach('file', Buffer.from('fake docx'), { filename: 'ficha.docx', contentType: DOCX_MIME })
      .expect(400));

  it('sem autenticação → 401', () =>
    request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-docx-with-spreadsheet`)
      .field('rows', JSON.stringify(ROWS))
      .attach('file', Buffer.from('fake docx'), { filename: 'ficha.docx', contentType: DOCX_MIME })
      .expect(401));
});
