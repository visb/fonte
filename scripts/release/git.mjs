// Acesso ao git do script de release (story 213). Só leitura: nunca cria tag,
// commit nem push — isso é da skill fonte-release, passo a passo, com o usuário.
import { execFileSync } from 'node:child_process';

const RECORD = '\x1e';
const FIELD = '\x1f';

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Última tag `v*` alcançável do HEAD; `null` na primeira release. */
export function lastTag(cwd) {
  try {
    return git(['describe', '--tags', '--abbrev=0', '--match', 'v*'], cwd).trim() || null;
  } catch {
    return null;
  }
}

/** Faz o parse da saída de `git log --format=<RECORD>%H<FIELD>%s<FIELD>%b<FIELD> --name-only`. */
export function parseLog(output) {
  return output
    .split(RECORD)
    .filter((record) => record.trim())
    .map((record) => {
      const [hash, subject, body, rest = ''] = record.split(FIELD);
      return {
        hash: hash.trim(),
        subject: subject.trim(),
        body: body.trim(),
        files: rest.split('\n').map((line) => line.trim()).filter(Boolean),
      };
    });
}

/**
 * Commits (sem merges) de `from` (exclusivo) até HEAD. Sem `from`, devolve o
 * histórico inteiro — a skill só chama assim depois de combinar com o usuário.
 */
export function readCommits(from, cwd) {
  const range = from ? `${from}..HEAD` : 'HEAD';
  const format = `--format=${RECORD}%H${FIELD}%s${FIELD}%b${FIELD}`;
  return parseLog(git(['log', '--no-merges', format, '--name-only', range], cwd));
}
