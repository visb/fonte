import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Catraca da story 182 — nenhuma suíte e2e limpa por CATEGORIA tabela que o seed
 * popula.
 *
 * Duas vezes o repo se machucou com a mesma linha: um `afterAll` fazendo
 * `DELETE FROM inventory_items WHERE kind = 'STOREROOM'` apagava o "Arroz (kg)"
 * do `seed-test.ts` e derrubava a suíte seguinte (e, quando havia contribuição em
 * produtos apontando para o item, o próprio DELETE estourava o
 * `CHK_rpc_item_xor_description`). A regra que faltava: **ninguém apaga linha que
 * não criou.**
 *
 * A lista de tabelas semeadas é DERIVADA do `seed-test.ts` (alvos de
 * `INSERT INTO`), não hardcodada: quando o seed passar a popular uma tabela nova,
 * a catraca cobre essa tabela sem ninguém lembrar de atualizar lista.
 *
 * É unit (lê arquivos; não sobe app nem banco) e roda em `pnpm test:api`.
 *
 * Limitação aceita: a análise é TEXTUAL, não semântica — um `DELETE` com `$1`
 * que por acaso apague demais passa. A catraca pega a classe de erro que já
 * aconteceu (limpeza por categoria), não toda limpeza ruim concebível.
 */

const API_DIR = join(__dirname, '..');
const REPO_ROOT = join(API_DIR, '..', '..');
const SEED_FILE = join(API_DIR, 'src', 'database', 'seed-test.ts');
const ADM_E2E_DIR = join(REPO_ROOT, 'apps', 'adm.fonte', 'e2e');

const QUOTES = new Set(['`', "'", '"']);

/**
 * Remove comentários preservando as linhas (comentário vira espaço). Sem isso o
 * próprio cabeçalho desta story — que CITA o `DELETE ... WHERE kind = '...'`
 * antigo para explicar por que ele saiu — seria acusado como violação. O que
 * importa é o código, não a prosa.
 */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
      continue;
    }
    if (QUOTES.has(char)) {
      const delimiter = char;
      out += char;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          out += source[i] + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += source[i];
        if (source[i] === delimiter) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += char;
    i++;
  }
  return out;
}

/** Tabelas que o seed de teste popula — alvos de `INSERT INTO`. */
function seededTables(seedSource: string): Set<string> {
  const tables = new Set<string>();
  const re = /INSERT\s+INTO\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(seedSource)) !== null) tables.add(match[1].toLowerCase());
  return tables;
}

/**
 * Texto do statement SQL que começa em `index`. Delimita pela string literal que
 * o contém (backtick/aspas), então statements multilinha entram inteiros — é o
 * que permite ver o `$1` que está numa linha abaixo do `DELETE FROM`.
 */
function statementAt(source: string, index: number): string {
  let open = -1;
  for (let i = index - 1; i >= 0; i--) {
    if (QUOTES.has(source[i])) {
      open = i;
      break;
    }
    if (source[i] === '\n') break;
  }
  if (open === -1) {
    const end = source.indexOf('\n', index);
    return source.slice(index, end === -1 ? source.length : end);
  }
  const delimiter = source[open];
  for (let i = index; i < source.length; i++) {
    if (source[i] === '\\') {
      i++;
      continue;
    }
    if (source[i] === delimiter) return source.slice(index, i);
  }
  return source.slice(index);
}

export interface CleanupViolation {
  file: string;
  line: number;
  table: string;
  statement: string;
}

/**
 * Reprova `DELETE FROM <tabela semeada>` que não esteja escopado por parâmetro
 * (`WHERE ... $1`). Tabela que o seed não popula segue livre: a suíte é dona dela.
 */
function scanSource(file: string, rawSource: string, seeded: Set<string>): CleanupViolation[] {
  const violations: CleanupViolation[] = [];
  const source = stripComments(rawSource);
  const re = /DELETE\s+FROM\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const table = match[1].toLowerCase();
    if (!seeded.has(table)) continue;
    const statement = statementAt(source, match.index);
    const scoped = /\bWHERE\b/i.test(statement) && /\$\d+/.test(statement);
    if (scoped) continue;
    violations.push({
      file,
      line: source.slice(0, match.index).split('\n').length,
      table,
      statement: statement.replace(/\s+/g, ' ').trim(),
    });
  }
  return violations;
}

function describeViolation(v: CleanupViolation): string {
  return (
    `${v.file}:${v.line} — "${v.statement}" apaga por categoria uma tabela que o seed-test.ts popula ` +
    `(${v.table}). Limpe por id da fixture: acumule os ids criados pela suíte e use ` +
    `WHERE <coluna> = ANY($1).`
  );
}

/** Arquivos varridos: e2e do backend + todo o repo de e2e do adm.fonte. */
function collectFiles(): string[] {
  const files = readdirSync(__dirname)
    .filter((name) => name.endsWith('.e2e-spec.ts'))
    .map((name) => join(__dirname, name));
  walk(ADM_E2E_DIR, files);
  return files;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.endsWith('.ts')) out.push(full);
  }
}

describe('escopo da limpeza das suítes e2e (catraca — story 182)', () => {
  const seeded = seededTables(readFileSync(SEED_FILE, 'utf8'));

  describe('lista de tabelas semeadas', () => {
    // Se o parser quebrar, o conjunto vazio faria a catraca aprovar tudo em
    // silêncio — este teste é o que a impede de virar decoração.
    it('deriva as tabelas do seed-test.ts e o conjunto não é vazio', () => {
      expect(seeded.size).toBeGreaterThan(5);
    });

    it('inclui as tabelas compartilhadas que já causaram quebra', () => {
      expect(seeded.has('inventory_items')).toBe(true);
      expect(seeded.has('residents')).toBe(true);
      expect(seeded.has('resident_receivables')).toBe(true);
    });

    it('não inclui tabela que o seed não popula', () => {
      expect(seeded.has('events')).toBe(false);
      expect(seeded.has('associates')).toBe(false);
    });
  });

  describe('regra aplicada a trechos fixture', () => {
    const scan = (snippet: string) => scanSource('fixture.ts', snippet, seeded);

    it('reprova limpeza por categoria em tabela semeada', () => {
      const found = scan("await ds.query(`DELETE FROM inventory_items WHERE kind = 'STOREROOM'`);");
      expect(found).toHaveLength(1);
      expect(found[0].table).toBe('inventory_items');
      expect(describeViolation(found[0])).toContain('Limpe por id da fixture');
    });

    it('aprova limpeza escopada por id da fixture', () => {
      expect(scan('await ds.query(`DELETE FROM inventory_items WHERE id = ANY($1)`, [ids]);')).toHaveLength(0);
    });

    it('aprova limpeza escopada em statement multilinha', () => {
      const snippet = [
        'await ds.query(`DELETE FROM residents',
        '  WHERE id = ANY($1)`, [ids]);',
      ].join('\n');
      expect(scan(snippet)).toHaveLength(0);
    });

    it('aprova DELETE total em tabela que o seed não popula (a suíte é dona dela)', () => {
      expect(scan("await ds.query('DELETE FROM events');")).toHaveLength(0);
      expect(scan("await ds.query('DELETE FROM associates');")).toHaveLength(0);
    });

    it('reprova DELETE sem WHERE em tabela semeada', () => {
      const found = scan("await ds.query('DELETE FROM residents');");
      expect(found).toHaveLength(1);
      expect(found[0].table).toBe('residents');
    });

    it('ignora DELETE citado em comentário (a regra vale para código, não para prosa)', () => {
      const snippet = [
        "// antes fazia DELETE FROM inventory_items WHERE kind = 'STOREROOM'",
        "/* e também DELETE FROM residents */",
        'await ds.query(`DELETE FROM inventory_items WHERE id = ANY($1)`, [ids]);',
      ].join('\n');
      expect(scan(snippet)).toHaveLength(0);
    });

    it('reprova WHERE sem placeholder (filtro literal não é escopo de fixture)', () => {
      const found = scan("await ds.query(`DELETE FROM residents WHERE name = 'João Testador'`);");
      expect(found).toHaveLength(1);
      expect(found[0].line).toBe(1);
    });
  });

  describe('árvore real do repositório', () => {
    const files = collectFiles();

    // Sem esta asserção a catraca poderia "passar" varrendo zero arquivo.
    it('varre os e2e do backend e do adm.fonte', () => {
      expect(files.length).toBeGreaterThan(20);
      expect(files.some((f) => f.endsWith(`test${sep}storerooms.e2e-spec.ts`))).toBe(true);
      expect(files.some((f) => f.endsWith(`e2e${sep}residents.spec.ts`))).toBe(true);
    });

    it('nenhuma suíte apaga em massa tabela populada pelo seed', () => {
      const violations = files.flatMap((file) =>
        scanSource(relative(REPO_ROOT, file), readFileSync(file, 'utf8'), seeded),
      );
      expect(violations.map(describeViolation)).toEqual([]);
    });
  });
});
